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
     * цикле, весь цикл укладывается в одну миллисекунду, и из двенадцати
     * запрошенных повторов доезжал один — при том, что пользователю
     * сообщалось «Создано повторов: 12».
     *
     * Префикс "local-" сохранён намеренно: на нём держится проверка
     * PostSessionNoteViewModel.isRemoteSessionId() и очередь досылки,
     * отличающая ещё не созданное на сервере от уже созданного.
     */
    private fun newLocalId(kind: String): String = "local-$kind-${clock()}"

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

    private companion object {
        const val KEY_CLIENTS = "clients"
        const val KEY_SESSIONS = "sessions"
        const val KEY_NOTES = "notes"
    }
}

@Serializable
data class LocalNoteDto(
    val id: String,
    val sessionId: String,
    val text: String,
    val createdAt: String,
)
