package ru.cmpas.app.data.local

import android.content.Context
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.serialization.decodeFromString
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import ru.cmpas.app.data.api.AnalyticsEventEnvelope
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Локальная очередь событий аналитики — своя, ОТДЕЛЬНАЯ от очереди досылки
 * практики (см. [LocalPracticeStore.OutboxEntry]): разная семантика (там —
 * идемпотентные бизнес-операции с зависимостями между записями, здесь —
 * готовые конверты аналитики, которые просто копятся и досылаются пачками)
 * и разный SLA (ПАДЕНИЕ АНАЛИТИКИ НЕ РОНЯЕТ ПРИЛОЖЕНИЕ — а значит и не
 * должно тянуть за собой бизнес-очередь, и наоборот). Собственный
 * SharedPreferences-файл — намеренно, чтобы отзыв согласия мог стереть
 * только эту очередь, ничего не задев в LocalPracticeStore.
 *
 * Потолок размера — как у эталона (compas-voice, `takeLast(500)`): без него
 * зависшая отправка (например, при выключенном флаге сети или постоянных
 * отказах сервера) постепенно съела бы всё SharedPreferences. Событие,
 * вытесненное потолком, теряется молча — это деградация телеметрии, не
 * пользовательских данных, и совместимо с «падение аналитики не роняет
 * приложение».
 */
@Singleton
class AnalyticsEventStore @Inject constructor(
    @ApplicationContext context: Context,
) {
    private val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    private val json = Json { ignoreUnknownKeys = true; encodeDefaults = true }

    /** Ставит конверт в очередь; при переполнении обрезает самые старые. */
    fun enqueue(envelope: AnalyticsEventEnvelope) {
        putAll((getAll() + envelope).takeLast(MAX_QUEUE_SIZE))
    }

    /** Первые [limit] событий в порядке постановки — не удаляет их из очереди. */
    fun peek(limit: Int): List<AnalyticsEventEnvelope> = getAll().take(limit)

    /** Удаляет только подтверждённые сервером события — партиал-фейл не трогает остальные. */
    fun removeByEventIds(eventIds: Set<String>) {
        if (eventIds.isEmpty()) return
        putAll(getAll().filterNot { it.eventId in eventIds })
    }

    /** Отзыв согласия обязан удалить уже собранные (но ещё не отправленные) события — не только выключить запись новых. */
    fun clear() {
        prefs.edit().remove(KEY_QUEUE).apply()
    }

    fun size(): Int = getAll().size

    private fun getAll(): List<AnalyticsEventEnvelope> {
        val raw = prefs.getString(KEY_QUEUE, null) ?: return emptyList()
        return runCatching { json.decodeFromString<List<AnalyticsEventEnvelope>>(raw) }.getOrDefault(emptyList())
    }

    private fun putAll(list: List<AnalyticsEventEnvelope>) {
        prefs.edit().putString(KEY_QUEUE, json.encodeToString(list)).apply()
    }

    private companion object {
        const val PREFS_NAME = "compas_analytics"
        const val KEY_QUEUE = "queue"
        const val MAX_QUEUE_SIZE = 500
    }
}
