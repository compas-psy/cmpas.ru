package ru.cmpas.app.data.analytics

import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Test

/**
 * Реестр событий — единственное место, которое решает, что вообще может
 * попасть в конверт аналитики. Проверяется без Android: чистые функции над
 * kotlinx.serialization.json.
 */
class AnalyticsSchemaTest {

    private val json = Json { encodeDefaults = true }

    @Test
    fun `необъявленное имя события отбрасывает всю запись`() {
        // screen_opened явно НЕ входит в семь событий, утверждённых
        // учредителем (решение №1) — проверяем, что схема это соблюдает.
        val envelope = buildAnalyticsEvent(
            "screen_opened",
            mapOf("surface" to jsonOf(SURFACE)),
            ts = "2026-08-23T10:00:00Z",
            eventId = "id-1",
        )
        assertNull(envelope)
    }

    @Test
    fun `неизвестное свойство тихо отбрасывается, событие всё равно строится`() {
        val envelope = requireNotNull(
            buildAnalyticsEvent(
                "client_created",
                mapOf(
                    "surface" to jsonOf(SURFACE),
                    "delivered" to jsonOf(true),
                    "client_note" to jsonOf("клиент рассказал про развод"),
                ),
                ts = "2026-08-23T10:00:00Z",
                eventId = "id-2",
            ),
        )
        assertEquals(setOf("surface", "delivered"), envelope.props.keys)
        assertFalse(
            "свободный текст просочился в тело события",
            json.encodeToString(envelope).contains("развод"),
        )
    }

    @Test
    fun `конверт на проводе не содержит account_id, device_id и product`() {
        val envelope = requireNotNull(
            buildAnalyticsEvent("app_opened", mapOf("surface" to jsonOf(SURFACE)), "2026-08-23T10:00:00Z", "id-3"),
        )
        val wire = json.encodeToString(envelope)
        assertFalse(wire.contains("account_id"))
        assertFalse(wire.contains("device_id"))
        assertFalse(wire.contains("\"product\""))
    }

    @Test
    fun `конверт несёт ровно event, ts, props, schema_version, event_id`() {
        val envelope = requireNotNull(
            buildAnalyticsEvent(
                "session_note_abandoned",
                mapOf("surface" to jsonOf(SURFACE), "had_input" to jsonOf(false)),
                "2026-08-23T10:00:00Z",
                "id-4",
            ),
        )
        val topLevelKeys = Json.parseToJsonElement(json.encodeToString(envelope)).jsonObject.keys
        assertEquals(setOf("event", "ts", "props", "schema_version", "event_id"), topLevelKeys)
    }

    @Test
    fun `каждое из семи событий держит ровно свой набор свойств`() {
        val everyPossibleProp = mapOf(
            "surface" to jsonOf(SURFACE),
            "first_launch" to jsonOf(true),
            "delivered" to jsonOf(true),
            "repeat_batch" to jsonOf(true),
            "days_ahead_bucket" to jsonOf("later"),
            "to" to jsonOf("confirmed"),
            "mode" to jsonOf("short"),
            "blocks_filled" to jsonOf(3),
            "since_session_bucket" to jsonOf("same_day"),
            "had_input" to jsonOf(true),
            "channel" to jsonOf("telegram"),
        )
        val expected = mapOf(
            "app_opened" to setOf("surface", "first_launch"),
            "session_created" to setOf("surface", "delivered", "repeat_batch", "days_ahead_bucket"),
            "session_status_changed" to setOf("surface", "to", "delivered"),
            "session_note_saved" to setOf("surface", "delivered", "mode", "blocks_filled", "since_session_bucket"),
            "session_note_abandoned" to setOf("surface", "had_input"),
            "client_created" to setOf("surface", "delivered"),
            "client_invite_created" to setOf("surface", "channel", "delivered"),
        )
        assertEquals("реестр разошёлся со списком из семи событий", expected.keys, KNOWN_EVENT_NAMES)
        expected.forEach { (name, keys) ->
            val envelope = requireNotNull(buildAnalyticsEvent(name, everyPossibleProp, "2026-08-23T10:00:00Z", "id"))
            assertEquals(name, keys, envelope.props.keys)
        }
    }
}
