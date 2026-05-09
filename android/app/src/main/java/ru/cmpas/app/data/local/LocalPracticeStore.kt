package ru.cmpas.app.data.local

import android.content.Context
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.serialization.Serializable
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
import java.time.LocalDateTime
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class LocalPracticeStore @Inject constructor(
    @ApplicationContext context: Context,
) {
    private val prefs = context.getSharedPreferences("compas_local_practice", Context.MODE_PRIVATE)
    private val json = Json { ignoreUnknownKeys = true; encodeDefaults = true }

    fun createClient(name: String, phone: String?, email: String?, notes: String?): Client {
        val client = Client(
            id = "local-client-${System.currentTimeMillis()}",
            name = name.ifBlank { "Новый клиент" },
            email = email?.ifBlank { null },
            phone = phone?.ifBlank { null },
            notes = notes?.ifBlank { null },
            status = ClientStatus.ACTIVE,
        )
        val updated = getClients().filterNot { it.id == client.id } + client
        prefs.edit().putString(KEY_CLIENTS, json.encodeToString(updated)).apply()
        return client
    }

    fun upsertClient(client: Client) {
        val updated = getClients().filterNot { it.id == client.id } + client
        prefs.edit().putString(KEY_CLIENTS, json.encodeToString(updated)).apply()
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
        notes: String?,
    ): Session {
        val session = Session(
            id = "local-session-${System.currentTimeMillis()}",
            clientId = client.id,
            clientName = client.name,
            date = date,
            startTime = startTime,
            endTime = endTime,
            status = SessionStatus.CONFIRMED,
            format = format,
            notes = notes?.ifBlank { null },
            paymentStatus = PaymentStatus.UNPAID,
            consentStatus = ConsentStatus.OK,
            homeworkStatus = HomeworkStatus.NOT_ASSIGNED,
        )
        val updated = getSessions().filterNot { it.id == session.id } + session
        prefs.edit().putString(KEY_SESSIONS, json.encodeToString(updated)).apply()
        return session
    }

    fun upsertSession(session: Session) {
        val updated = getSessions().filterNot { it.id == session.id } + session
        prefs.edit().putString(KEY_SESSIONS, json.encodeToString(updated)).apply()
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
            id = "local-note-${System.currentTimeMillis()}",
            sessionId = sessionId,
            text = text,
            createdAt = LocalDateTime.now().toString(),
        )
        val updated = getNotes() + note
        prefs.edit().putString(KEY_NOTES, json.encodeToString(updated)).apply()

        getSessions().firstOrNull { it.id == sessionId }?.let { session ->
            upsertSession(session.copy(notes = text))
        }

        return note
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
