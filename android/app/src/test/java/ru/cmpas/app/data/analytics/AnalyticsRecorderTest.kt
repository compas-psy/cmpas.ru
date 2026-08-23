package ru.cmpas.app.data.analytics

import kotlinx.coroutines.runBlocking
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.int
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import ru.cmpas.app.data.api.AnalyticsEventEnvelope
import java.time.Instant

/**
 * AnalyticsRecorder проверяется без Android/DataStore/Hilt: зависимости —
 * suspend-лямбды, подставляем их напрямую.
 */
class AnalyticsRecorderTest {

    private fun newRecorder(
        consentGranted: Boolean,
        sink: MutableList<AnalyticsEventEnvelope> = mutableListOf(),
    ): Pair<AnalyticsRecorder, MutableList<AnalyticsEventEnvelope>> {
        val recorder = AnalyticsRecorder(
            isConsentGranted = { consentGranted },
            enqueue = { sink.add(it) },
            eventId = { "fixed-event-id" },
            now = { Instant.parse("2026-08-23T10:00:00Z") },
        )
        return recorder to sink
    }

    private fun AnalyticsEventEnvelope.prop(key: String) = props.getValue(key) as JsonPrimitive

    // ── Гейт согласия (первый из двух, ДВОЙНОГО) ────────────────────────

    @Test
    fun `без согласия ни один record не ставит событие в очередь`() = runBlocking {
        val (recorder, sink) = newRecorder(consentGranted = false)

        recorder.recordAppOpened()
        recorder.recordSessionCreated(delivered = true)
        recorder.recordSessionStatusChanged(SessionStatusTarget.CONFIRMED, delivered = true)
        recorder.recordSessionNoteSaved(delivered = true, mode = NoteMode.SHORT)
        recorder.recordSessionNoteAbandoned(hadInput = true)
        recorder.recordClientCreated(delivered = true)
        recorder.recordClientInviteCreated(InviteChannel.TELEGRAM, delivered = true)

        assertTrue("без согласия очередь обязана остаться пустой", sink.isEmpty())
    }

    @Test
    fun `с согласием событие ставится в очередь с event_id, рождённым при постановке`() = runBlocking {
        val (recorder, sink) = newRecorder(consentGranted = true)

        recorder.recordClientCreated(delivered = true)

        assertEquals(1, sink.size)
        assertEquals("client_created", sink.single().event)
        assertEquals("event_id должен рождаться в момент постановки в очередь", "fixed-event-id", sink.single().eventId)
    }

    // ── Форма конверта ────────────────────────────────────────────────

    @Test
    fun `surface всегда android — не параметр вызывающего кода`() = runBlocking {
        val (recorder, sink) = newRecorder(consentGranted = true)
        recorder.recordAppOpened()
        assertEquals("android", sink.single().prop("surface").content)
    }

    @Test
    fun `конверт содержит ровно объявленные свойства события`() = runBlocking {
        val (recorder, sink) = newRecorder(consentGranted = true)
        recorder.recordSessionNoteAbandoned(hadInput = true)

        assertEquals(setOf("surface", "had_input"), sink.single().props.keys)
    }

    @Test
    fun `blocks_filled клампится на границе 0 и 5`() = runBlocking {
        val (recorder, sink) = newRecorder(consentGranted = true)

        recorder.recordSessionNoteSaved(delivered = true, mode = NoteMode.BLOCKS, blocksFilled = 9)
        recorder.recordSessionNoteSaved(delivered = true, mode = NoteMode.BLOCKS, blocksFilled = -3)
        recorder.recordSessionNoteSaved(delivered = true, mode = NoteMode.BLOCKS, blocksFilled = 2)

        val clamped = sink.map { it.prop("blocks_filled").int }
        assertEquals(listOf(5, 0, 2), clamped)
    }

    @Test
    fun `перечисления уходят на провод строками из values реестра`() = runBlocking {
        val (recorder, sink) = newRecorder(consentGranted = true)

        recorder.recordSessionStatusChanged(SessionStatusTarget.RESCHEDULED, delivered = true)
        recorder.recordSessionNoteSaved(
            delivered = true,
            mode = NoteMode.BLOCKS,
            sinceSessionBucket = SinceSessionBucket.NEXT_DAY,
        )
        recorder.recordClientInviteCreated(InviteChannel.MAX, delivered = true)
        recorder.recordSessionCreated(delivered = true, daysAheadBucket = DaysAheadBucket.WITHIN_MONTH)

        assertEquals("rescheduled", sink[0].prop("to").content)
        assertEquals("next_day", sink[1].prop("since_session_bucket").content)
        assertEquals("max", sink[2].prop("channel").content)
        assertEquals("within_month", sink[3].prop("days_ahead_bucket").content)
    }
}
