package ru.cmpas.app.data.local

import android.content.Context
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.serialization.Serializable
import kotlinx.serialization.decodeFromString
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import ru.cmpas.app.domain.model.Client
import ru.cmpas.app.domain.model.ClientStatus
import ru.cmpas.app.domain.model.ConsentStatus
import ru.cmpas.app.domain.model.HomeworkStatus
import ru.cmpas.app.domain.model.PaymentStatus
import ru.cmpas.app.domain.model.Session
import ru.cmpas.app.domain.model.SessionFormat
import ru.cmpas.app.domain.model.SessionStatus
import ru.cmpas.app.domain.model.SessionType
import java.time.LocalDateTime
import java.util.UUID
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class LocalPracticeStore @Inject constructor(
    @ApplicationContext context: Context,
) {
    /**
     * Часы вынесены в поле, чтобы тест мог их заморозить.
     *
     * Замер «сколько повторов теряется» нельзя ставить на скорость машины:
     * на быстрой JVM весь цикл укладывается в одну миллисекунду и все записи
     * затирают друг друга, а на Robolectric в CI каждая итерация занимает
     * больше миллисекунды и совпадения не случается вовсе. Тест, зависящий от
     * скорости, ничего не доказывает ни зелёный, ни красный. С замороженными
     * часами проверяется само правило: id не имеет права зависеть от времени.
     */
    internal var clock: () -> Long = System::currentTimeMillis

    private val prefs = context.getSharedPreferences("compas_local_practice", Context.MODE_PRIVATE)
    private val json = Json { ignoreUnknownKeys = true; encodeDefaults = true }

    /**
     * Идентификатор локальной записи.
     *
     * Раньше строился из System.currentTimeMillis(), а запись в хранилище
     * делается как `filterNot { it.id == item.id } + item` — то есть
     * совпадение id не порождало дубль, а УДАЛЯЛО предыдущую запись.
     * QuickActionViewModel.saveRepeatedSlot() зовёт createSession() в тесном
     * цикле, и попадание двух итераций в одну миллисекунду стирало повтор —
     * при том, что пользователю сообщалось «Создано повторов: N».
     *
     * Сколько записей терялось на реальном устройстве — не измерено и здесь не
     * утверждается: это зависит от скорости записи в SharedPreferences.
     * Правило проверяет LocalPracticeStoreIdTest с замороженными часами: id
     * локальной записи не имеет права зависеть от времени.
     *
     * Префикс "local-" сохранён намеренно: на нём держится проверка
     * PostSessionNoteViewModel.isRemoteSessionId() и очередь досылки,
     * отличающая ещё не созданное на сервере от уже созданного.
     */
    private fun newLocalId(kind: String): String = "local-$kind-${UUID.randomUUID()}"

    fun createClient(name: String, phone: String?, email: String?, gender: String?, notes: String?): Client {
        val client = Client(
            id = newLocalId("client"),
            name = name.ifBlank { "Новый клиент" },
            email = email?.ifBlank { null },
            phone = phone?.ifBlank { null },
            gender = gender?.ifBlank { null },
            notes = notes?.ifBlank { null },
            status = ClientStatus.ACTIVE,
        )
        prefs.edit().putString(KEY_CLIENTS, json.encodeToString(getClients().filterNot { it.id == client.id } + client)).apply()
        return client
    }

    fun upsertClient(client: Client) {
        prefs.edit().putString(KEY_CLIENTS, json.encodeToString(getClients().filterNot { it.id == client.id } + client)).apply()
    }

    fun getClients(): List<Client> {
        val raw = prefs.getString(KEY_CLIENTS, null) ?: return emptyList()
        return runCatching { json.decodeFromString<List<Client>>(raw) }.getOrDefault(emptyList())
    }

    fun createSession(
        client: Client,
        date: String,
        startTime: String,
        endTime: String,
        format: SessionFormat,
        type: SessionType = SessionType.INDIVIDUAL,
        notes: String?,
    ): Session {
        val session = Session(
            id = newLocalId("session"),
            clientId = client.id,
            clientName = client.name,
            date = date,
            startTime = startTime,
            endTime = endTime,
            status = SessionStatus.CONFIRMED,
            format = format,
            type = type,
            notes = notes?.ifBlank { null },
            paymentStatus = PaymentStatus.UNPAID,
            consentStatus = ConsentStatus.OK,
            homeworkStatus = HomeworkStatus.NOT_ASSIGNED,
        )
        prefs.edit().putString(KEY_SESSIONS, json.encodeToString(getSessions().filterNot { it.id == session.id } + session)).apply()
        return session
    }

    fun upsertSession(session: Session) {
        prefs.edit().putString(KEY_SESSIONS, json.encodeToString(getSessions().filterNot { it.id == session.id } + session)).apply()
    }

    fun getSessions(from: String? = null, to: String? = null): List<Session> {
        val raw = prefs.getString(KEY_SESSIONS, null) ?: return emptyList()
        val sessions = runCatching { json.decodeFromString<List<Session>>(raw) }.getOrDefault(emptyList())
        return sessions.filter { session ->
            val afterFrom = from == null || session.date >= from
            val beforeTo = to == null || session.date <= to
            afterFrom && beforeTo
        }
    }

    fun saveNote(sessionId: String, text: String): LocalNoteDto {
        val note = LocalNoteDto(
            id = newLocalId("note"),
            sessionId = sessionId,
            text = text,
            createdAt = LocalDateTime.now().toString(),
        )
        prefs.edit().putString(KEY_NOTES, json.encodeToString(getNotes().filterNot { it.sessionId == sessionId } + note)).apply()
        getSessions().firstOrNull { it.id == sessionId }?.let { session -> upsertSession(session.copy(notes = text)) }
        return note
    }

    fun getLatestNote(sessionId: String): LocalNoteDto? {
        return getNotes().filter { it.sessionId == sessionId }.maxByOrNull { it.createdAt }
    }

    fun getNotes(): List<LocalNoteDto> {
        val raw = prefs.getString(KEY_NOTES, null) ?: return emptyList()
        return runCatching { json.decodeFromString<List<LocalNoteDto>>(raw) }.getOrDefault(emptyList())
    }

    // ═══════════════════════════════════════════════════════════════════
    // Очередь досылки
    // ═══════════════════════════════════════════════════════════════════
    //
    // Всё, что не доехало до сервера, оседало здесь навсегда: методов досылки
    // не было ни одного, и записанное в это хранилище не появлялось ни в вебе,
    // ни у клиента, ни в панели, а при переустановке пропадало совсем.
    //
    // Очередь не хранит копию запроса: сама запись уже лежит в этом же
    // хранилище, и найти её можно по localId. Две копии одних данных разошлись
    // бы при первой же правке записи.

    fun getOutbox(): List<OutboxEntry> {
        val raw = prefs.getString(KEY_OUTBOX, null) ?: return emptyList()
        return runCatching { json.decodeFromString<List<OutboxEntry>>(raw) }.getOrDefault(emptyList())
    }

    private fun putOutbox(entries: List<OutboxEntry>) {
        prefs.edit().putString(KEY_OUTBOX, json.encodeToString(entries)).apply()
    }

    /**
     * Ставит запись в очередь. Ключ идемпотентности рождается ЗДЕСЬ, в момент
     * постановки, а не в момент отправки: если ответ сервера потеряется, повтор
     * уйдёт с тем же ключом и не создаст вторую сессию.
     *
     * Повторная постановка того же localId — не ошибка и не дубль: запись
     * просто остаётся в очереди с прежним ключом.
     */
    fun enqueue(kind: String, localId: String, dependsOnLocalId: String? = null) {
        val current = getOutbox()
        if (current.any { it.localId == localId }) return
        putOutbox(
            current + OutboxEntry(
                opId = UUID.randomUUID().toString(),
                kind = kind,
                localId = localId,
                dependsOnLocalId = dependsOnLocalId,
                createdAt = LocalDateTime.now().toString(),
            ),
        )
    }

    fun removeFromOutbox(localId: String) {
        putOutbox(getOutbox().filterNot { it.localId == localId })
    }

    fun markOutboxFailure(localId: String, error: String?) {
        putOutbox(
            getOutbox().map {
                if (it.localId == localId) it.copy(attempts = it.attempts + 1, lastError = error) else it
            },
        )
    }

    /** Сколько записей ещё не доставлено — то, что видит специалист. */
    fun pendingCount(): Int = getOutbox().size

    // ── Переназначение идентификаторов ──────────────────────────────────
    //
    // Локальный клиент получает id вида local-client-…; сессия, заведённая для
    // него, ссылается на этот id. Сервер такого клиента не знает, поэтому
    // наивная очередь «повторить каждый запрос» вечно слала бы сессии с
    // несуществующим клиентом. После успешного создания клиента его локальный
    // id заменяется настоящим — и в самой карточке, и во всех ссылающихся
    // сессиях, и в очереди.

    fun remapClientId(localId: String, serverId: String) {
        val clients = getClients().map { if (it.id == localId) it.copy(id = serverId) else it }
        prefs.edit().putString(KEY_CLIENTS, json.encodeToString(clients)).apply()

        val sessions = getSessions().map { if (it.clientId == localId) it.copy(clientId = serverId) else it }
        prefs.edit().putString(KEY_SESSIONS, json.encodeToString(sessions)).apply()

        putOutbox(getOutbox().map { if (it.dependsOnLocalId == localId) it.copy(dependsOnLocalId = null) else it })
    }

    fun remapSessionId(localId: String, serverId: String) {
        val sessions = getSessions().map { if (it.id == localId) it.copy(id = serverId) else it }
        prefs.edit().putString(KEY_SESSIONS, json.encodeToString(sessions)).apply()

        val notes = getNotes().map { if (it.sessionId == localId) it.copy(sessionId = serverId) else it }
        prefs.edit().putString(KEY_NOTES, json.encodeToString(notes)).apply()

        putOutbox(getOutbox().map { if (it.dependsOnLocalId == localId) it.copy(dependsOnLocalId = null) else it })
    }

    /**
     * Разбор накопленного: всё локальное, чего нет в очереди, ставится в неё.
     *
     * Без этого починка не вернула бы ничего из уже потерянного — очередь
     * подхватывала бы только новое, а осевшее на телефонах раньше так и
     * осталось бы лежать мёртвым грузом. Вызывается при каждом заходе, а не
     * однократно по флагу: так же чинится и запись, выпавшая из очереди по
     * любой другой причине.
     */
    fun enqueueOrphans() {
        getClients().filter { it.id.startsWith("local-client-") }
            .forEach { enqueue("client", it.id) }
        getSessions().filter { it.id.startsWith("local-session-") }
            .forEach { session ->
                enqueue(
                    kind = "session",
                    localId = session.id,
                    dependsOnLocalId = session.clientId.takeIf { it.startsWith("local-client-") },
                )
            }
        // Заметка к серверной сессии, не доехавшая из-за отказа сервера,
        // локального id не имеет — её опознаём по расхождению с сессией.
        getNotes().forEach { note ->
            val session = getSessions().firstOrNull { it.id == note.sessionId }
            if (session != null && session.notes != note.text) {
                enqueue(
                    kind = "note",
                    localId = note.id,
                    dependsOnLocalId = note.sessionId.takeIf { it.startsWith("local-session-") },
                )
            }
        }
    }

    fun noteById(id: String): LocalNoteDto? = getNotes().firstOrNull { it.id == id }
    fun clientById(id: String): Client? = getClients().firstOrNull { it.id == id }
    fun sessionById(id: String): Session? = getSessions().firstOrNull { it.id == id }

    private companion object {
        const val KEY_CLIENTS = "clients"
        const val KEY_SESSIONS = "sessions"
        const val KEY_NOTES = "notes"
        const val KEY_OUTBOX = "outbox"
    }
}

/**
 * Запись очереди досылки.
 *
 * Копии запроса здесь нет намеренно: сами данные лежат в хранилище и находятся
 * по localId. `opId` — ключ идемпотентности, рождённый при постановке в очередь;
 * он уходит на сервер в поле clientRequestId, и повтор после потерянного ответа
 * возвращает уже созданное, а не создаёт второе.
 */
@Serializable
data class OutboxEntry(
    val opId: String,
    val kind: String,
    val localId: String,
    val dependsOnLocalId: String? = null,
    val createdAt: String,
    val attempts: Int = 0,
    val lastError: String? = null,
)

@Serializable
data class LocalNoteDto(
    val id: String,
    val sessionId: String,
    val text: String,
    val createdAt: String,
)
