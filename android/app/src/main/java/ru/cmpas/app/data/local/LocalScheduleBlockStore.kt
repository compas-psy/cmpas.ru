package ru.cmpas.app.data.local

import android.content.Context
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import ru.cmpas.app.domain.model.ConsentStatus
import ru.cmpas.app.domain.model.HomeworkStatus
import ru.cmpas.app.domain.model.PaymentStatus
import ru.cmpas.app.domain.model.Session
import ru.cmpas.app.domain.model.SessionFormat
import ru.cmpas.app.domain.model.SessionStatus
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class LocalScheduleBlockStore @Inject constructor(
    @ApplicationContext context: Context,
) {
    private val prefs = context.getSharedPreferences("compas_schedule_blocks", Context.MODE_PRIVATE)
    private val json = Json { ignoreUnknownKeys = true; encodeDefaults = true }

    fun saveBlock(title: String, type: String?, date: String, startTime: String, endTime: String, comment: String?): Session {
        val block = ScheduleBlockDto(
            id = "block-${System.currentTimeMillis()}",
            title = title.ifBlank { "Блокировка" },
            type = type?.ifBlank { null },
            date = date,
            startTime = startTime,
            endTime = endTime,
            comment = comment?.ifBlank { null },
        )
        val updated = loadDtos() + block
        prefs.edit().putString(KEY_BLOCKS, json.encodeToString(updated)).apply()
        return block.toSession()
    }

    fun getBlocks(from: String, to: String): List<Session> {
        return loadDtos()
            .filter { it.date >= from && it.date <= to }
            .map { it.toSession() }
    }

    private fun loadDtos(): List<ScheduleBlockDto> {
        val raw = prefs.getString(KEY_BLOCKS, null) ?: return emptyList()
        return runCatching { json.decodeFromString<List<ScheduleBlockDto>>(raw) }.getOrDefault(emptyList())
    }

    private fun ScheduleBlockDto.toSession(): Session = Session(
        id = id,
        clientId = "local-block",
        clientName = title,
        date = date,
        startTime = startTime,
        endTime = endTime,
        status = SessionStatus.CONFIRMED,
        format = SessionFormat.IN_PERSON,
        notes = buildString {
            append("Блокировка расписания")
            type?.let { append(" · ").append(it) }
            comment?.let { append("\n").append(it) }
        },
        paymentStatus = PaymentStatus.NOT_REQUIRED,
        consentStatus = ConsentStatus.OK,
        homeworkStatus = HomeworkStatus.NOT_ASSIGNED,
    )

    private companion object {
        const val KEY_BLOCKS = "blocks"
    }
}

@Serializable
private data class ScheduleBlockDto(
    val id: String,
    val title: String,
    val type: String? = null,
    val date: String,
    val startTime: String,
    val endTime: String,
    val comment: String? = null,
)
