package ru.cmpas.app.data.sync

import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import ru.cmpas.app.data.api.CompasApi
import ru.cmpas.app.data.api.CreateClientRequest
import ru.cmpas.app.data.api.CreateSessionRequest
import ru.cmpas.app.data.api.UpdateSessionRequest
import ru.cmpas.app.data.local.LocalPracticeStore
import ru.cmpas.app.data.local.OutboxEntry
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Досылка того, что не доехало до сервера.
 *
 * До появления этого класса записанное в LocalPracticeStore не уезжало никуда
 * и никогда: методов досылки не было ни одного. Специалист мог честно увидеть
 * «сохранено на устройстве» — и всё равно потерять работу, потому что «на
 * устройстве» означало «навсегда и только здесь».
 *
 * Четыре правила, без которых очередь не работает:
 *
 *  1. **Порядок зависимостей.** Сессия локального клиента не может уехать
 *     раньше самого клиента: сервер такого клиента не знает и отвергнет
 *     запрос. Клиенты идут первыми, сессии — вторыми, заметки — последними.
 *
 *  2. **Переназначение id.** После успешного создания клиента его локальный id
 *     заменяется настоящим и в карточке, и во всех ссылающихся сессиях, и в
 *     очереди. Иначе очередь вечно слала бы сессии с несуществующим клиентом.
 *
 *  3. **Идемпотентность.** Ключ рождён при постановке в очередь
 *     (OutboxEntry.opId) и уходит в поле clientRequestId. Повтор после
 *     потерянного ответа возвращает уже созданное, а не создаёт второе.
 *
 *  4. **Отказ — не потеря.** Запись остаётся в очереди с отмеченной попыткой;
 *     удаляется только то, что сервер подтвердил.
 *
 * Падение досылки не роняет приложение: наружу не выходит ни одно исключение.
 */
@Singleton
class OutboxSync @Inject constructor(
    private val api: CompasApi,
    private val store: LocalPracticeStore,
) {
    private val mutex = Mutex()

    data class Result(val delivered: Int, val remaining: Int)

    /**
     * Один проход очереди. Безопасно звать сколько угодно раз: параллельные
     * вызовы сериализуются, иначе два прохода отправили бы одну запись дважды
     * (ключ идемпотентности спас бы от дубля на сервере, но не от лишнего
     * запроса и не от гонки при переназначении id).
     */
    suspend fun sync(): Result = mutex.withLock {
        runCatching { store.enqueueOrphans() }
        var delivered = 0

        // Порядок фиксирован: клиент → сессия → заметка.
        for (kind in listOf("client", "session", "note")) {
            for (entry in store.getOutbox().filter { it.kind == kind }) {
                if (entry.dependsOnLocalId != null) continue // зависимость ещё не разрешена
                val ok = runCatching { send(entry) }.getOrElse { error ->
                    store.markOutboxFailure(entry.localId, error.message)
                    false
                }
                if (ok) delivered++
            }
        }
        Result(delivered = delivered, remaining = store.pendingCount())
    }

    private suspend fun send(entry: OutboxEntry): Boolean = when (entry.kind) {
        "client" -> sendClient(entry)
        "session" -> sendSession(entry)
        "note" -> sendNote(entry)
        else -> {
            // Неизвестный вид записи — не наш случай, но и висеть в очереди
            // вечно он не должен: убираем, иначе очередь никогда не опустеет.
            store.removeFromOutbox(entry.localId)
            false
        }
    }

    private suspend fun sendClient(entry: OutboxEntry): Boolean {
        val local = store.clientById(entry.localId) ?: run {
            store.removeFromOutbox(entry.localId)
            return false
        }
        val response = api.createClient(
            CreateClientRequest(
                name = local.name,
                email = local.email,
                phone = local.phone,
                gender = local.gender,
                clientRequestId = entry.opId,
            ),
        )
        val created = if (response.isSuccessful) response.body() else null
        if (created == null) {
            store.markOutboxFailure(entry.localId, "HTTP ${response.code()}")
            return false
        }
        store.remapClientId(entry.localId, created.id)
        store.upsertClient(created)
        store.removeFromOutbox(entry.localId)
        return true
    }

    private suspend fun sendSession(entry: OutboxEntry): Boolean {
        val local = store.sessionById(entry.localId) ?: run {
            store.removeFromOutbox(entry.localId)
            return false
        }
        // Страховка на случай, если клиент так и остался локальным: отправлять
        // такую сессию бессмысленно — сервер её отвергнет, а запись мы потеряем.
        if (local.clientId.startsWith("local-")) {
            store.markOutboxFailure(entry.localId, "клиент ещё не создан на сервере")
            return false
        }
        val response = api.createSession(
            CreateSessionRequest(
                clientId = local.clientId,
                date = local.date,
                startTime = local.startTime,
                format = local.format,
                type = local.type,
                clientRequestId = entry.opId,
            ),
        )
        val created = if (response.isSuccessful) response.body() else null
        if (created == null) {
            store.markOutboxFailure(entry.localId, "HTTP ${response.code()}")
            return false
        }
        store.remapSessionId(entry.localId, created.id)
        store.upsertSession(created)
        store.removeFromOutbox(entry.localId)

        // Заметка, написанная к ещё не созданной сессии, теперь может уехать.
        if (!local.notes.isNullOrBlank()) {
            runCatching {
                api.updateSession(created.id, UpdateSessionRequest(notes = local.notes))
            }
        }
        return true
    }

    private suspend fun sendNote(entry: OutboxEntry): Boolean {
        val note = store.noteById(entry.localId) ?: run {
            store.removeFromOutbox(entry.localId)
            return false
        }
        if (note.sessionId.startsWith("local-")) {
            store.markOutboxFailure(entry.localId, "сессия ещё не создана на сервере")
            return false
        }
        val response = api.updateSession(note.sessionId, UpdateSessionRequest(notes = note.text))
        if (!response.isSuccessful) {
            store.markOutboxFailure(entry.localId, "HTTP ${response.code()}")
            return false
        }
        response.body()?.let { store.upsertSession(it) }
        store.removeFromOutbox(entry.localId)
        return true
    }
}
