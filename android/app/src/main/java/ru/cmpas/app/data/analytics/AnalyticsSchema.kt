package ru.cmpas.app.data.analytics

import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import ru.cmpas.app.data.api.AnalyticsEventEnvelope

private const val SCHEMA_VERSION = 1

/** Приложение всегда шлёт `surface=android` — это константа, не параметр вызывающего кода. */
internal const val SURFACE = "android"

/**
 * Реестр допустимых событий и их свойств — зеркало СЕМИ мобильных событий
 * ПРАКТИКИ из `analytics/schema/events.yaml` (app_opened … client_invite_created,
 * без screen_opened). Единственное место, которое решает, что вообще может
 * попасть в событие:
 *
 *  - необъявленное имя события → вся запись отбрасывается ([buildAnalyticsEvent] вернёт null);
 *  - необъявленное свойство для своего события → тихо выбрасывается, само событие уходит без него.
 *
 * Это структурная защита правила «содержание записей клиентов не измеряется
 * никогда» — ни одно свойство здесь не несёт свободный текст, поэтому
 * произвольная строка (текст заметки, имя клиента) физически не может
 * пройти через этот фильтр, даже если её случайно передадут в props вызова.
 */
private val EVENT_SCHEMA: Map<String, Set<String>> = mapOf(
    "app_opened" to setOf("surface", "first_launch"),
    "session_created" to setOf("surface", "delivered", "repeat_batch", "days_ahead_bucket"),
    "session_status_changed" to setOf("surface", "to", "delivered"),
    "session_note_saved" to setOf("surface", "delivered", "mode", "blocks_filled", "since_session_bucket"),
    "session_note_abandoned" to setOf("surface", "had_input"),
    "client_created" to setOf("surface", "delivered"),
    "client_invite_created" to setOf("surface", "channel", "delivered"),
)

/** Имена всех допустимых событий — используется тестами и, при желании, диагностикой. */
internal val KNOWN_EVENT_NAMES: Set<String> get() = EVENT_SCHEMA.keys

/**
 * Собирает конверт события в формате провода `POST /api/mobile/analytics` —
 * `{event, ts, props, schema_version, event_id}`, без product/account_id/
 * device_id: их подставляет сервер из JWT. Возвращает null для
 * необъявленного имени события — вызывающий код ([AnalyticsRecorder])
 * обязан в этом случае не ставить событие в очередь вовсе.
 */
internal fun buildAnalyticsEvent(
    name: String,
    props: Map<String, JsonElement>,
    ts: String,
    eventId: String,
): AnalyticsEventEnvelope? {
    val allowed = EVENT_SCHEMA[name] ?: return null
    val filteredProps = buildJsonObject {
        props.filterKeys { it in allowed }.forEach { (key, value) -> put(key, value) }
    }
    return AnalyticsEventEnvelope(
        event = name,
        ts = ts,
        props = filteredProps,
        schemaVersion = SCHEMA_VERSION,
        eventId = eventId,
    )
}

internal fun jsonOf(value: String): JsonElement = JsonPrimitive(value)
internal fun jsonOf(value: Boolean): JsonElement = JsonPrimitive(value)
internal fun jsonOf(value: Int): JsonElement = JsonPrimitive(value)
