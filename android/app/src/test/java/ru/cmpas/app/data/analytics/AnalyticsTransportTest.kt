package ru.cmpas.app.data.analytics

import kotlinx.coroutines.runBlocking
import kotlinx.serialization.json.buildJsonObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import ru.cmpas.app.data.api.AnalyticsEventEnvelope

/**
 * AnalyticsTransport проверяется без Android/Retrofit: [sendBatch] —
 * suspend-лямбда, подставляем поведение сервера напрямую, включая ровно тот
 * случай, который сломан в справочной реализации МОМЕНТОВ: HTTP 200 с
 * {accepted:false} обязан НЕ считаться успехом.
 */
class AnalyticsTransportTest {

    private fun envelope(id: String) = AnalyticsEventEnvelope(
        event = "client_created",
        ts = "2026-08-23T10:00:00Z",
        props = buildJsonObject { },
        schemaVersion = 1,
        eventId = id,
    )

    private class FakeClock(var value: Long = 0L) {
        val fn: () -> Long = { value }
    }

    // ── Гейт согласия (второй из двух, ДВОЙНОГО) ────────────────────────

    @Test
    fun `без согласия flush не зовёт sendBatch и не трогает очередь`() = runBlocking {
        var sendCalled = false
        val queue = mutableListOf(envelope("a"))
        val transport = AnalyticsTransport(
            isConsentGranted = { false },
            peekQueue = { limit -> queue.take(limit) },
            removeSent = { ids -> queue.removeAll { it.eventId in ids } },
            sendBatch = { sendCalled = true; listOf(true) },
        )

        transport.flush()

        assertFalse("без согласия отправка не должна происходить вовсе", sendCalled)
        assertEquals(1, queue.size)
    }

    // ── {accepted:false} при HTTP 200 — не успех ────────────────────────

    @Test
    fun `accepted false при HTTP 200 не удаляет событие из очереди`() = runBlocking {
        val queue = mutableListOf(envelope("rejected"))
        val transport = AnalyticsTransport(
            isConsentGranted = { true },
            peekQueue = { limit -> queue.take(limit) },
            removeSent = { ids -> queue.removeAll { it.eventId in ids } },
            // HTTP 200 дошёл, тело разобрано, но сервер отверг событие —
            // это НЕ считать успехом (контракт приёмника).
            sendBatch = { batch -> batch.map { false } },
        )

        transport.flush()

        assertEquals("{accepted:false} должно было оставить событие в очереди", 1, queue.size)
        assertEquals("rejected", queue.single().eventId)
    }

    // ── partial failure — удаляет только подтверждённое ─────────────────

    @Test
    fun `partial failure удаляет только подтверждённые события`() = runBlocking {
        val queue = mutableListOf(envelope("ok-1"), envelope("bad"), envelope("ok-2"))
        val transport = AnalyticsTransport(
            isConsentGranted = { true },
            peekQueue = { limit -> queue.take(limit) },
            removeSent = { ids -> queue.removeAll { it.eventId in ids } },
            sendBatch = { batch -> batch.map { it.eventId != "bad" } },
        )

        transport.flush()

        assertEquals(listOf("bad"), queue.map { it.eventId })
    }

    @Test
    fun `весь запрос не доехал (null от sendBatch) — очередь не трогаем`() = runBlocking {
        val queue = mutableListOf(envelope("a"), envelope("b"))
        val transport = AnalyticsTransport(
            isConsentGranted = { true },
            peekQueue = { limit -> queue.take(limit) },
            removeSent = { ids -> queue.removeAll { it.eventId in ids } },
            sendBatch = { null },
        )

        transport.flush()

        assertEquals(2, queue.size)
    }

    // ── бэкофф ────────────────────────────────────────────────────────

    @Test
    fun `бэкофф растёт после неудачи и блокирует следующий flush до истечения срока`() = runBlocking {
        val clock = FakeClock(0L)
        val queue = mutableListOf(envelope("a"))
        var sendAttempts = 0
        val transport = AnalyticsTransport(
            isConsentGranted = { true },
            peekQueue = { limit -> queue.take(limit) },
            removeSent = { ids -> queue.removeAll { it.eventId in ids } },
            sendBatch = { sendAttempts++; null },
            now = clock.fn,
        )

        transport.flush() // 1-я неудача: следующая попытка не раньше now()+30_000
        assertEquals(1, sendAttempts)

        clock.value = 1_000L // ещё не наступил момент следующей попытки
        transport.flush()
        assertEquals("flush до истечения бэкоффа не должен слать ничего", 1, sendAttempts)

        clock.value = 31_000L // срок истёк
        transport.flush()
        assertEquals(2, sendAttempts)
    }

    @Test
    fun `бэкофф сбрасывается на успехе`() = runBlocking {
        val clock = FakeClock(0L)
        val queue = mutableListOf(envelope("a"))
        var shouldFail = true
        val attemptTimestamps = mutableListOf<Long>()
        val transport = AnalyticsTransport(
            isConsentGranted = { true },
            peekQueue = { limit -> queue.take(limit) },
            removeSent = { ids -> queue.removeAll { it.eventId in ids } },
            sendBatch = { batch ->
                attemptTimestamps.add(clock.value)
                if (shouldFail) null else batch.map { true }
            },
            now = clock.fn,
        )

        transport.flush() // неудача → бэкофф 30_000
        clock.value = 30_000L
        shouldFail = false
        transport.flush() // успех → очередь опустела, бэкофф сброшен
        assertTrue(queue.isEmpty())

        // Следующая неудача должна снова ждать ТОЛЬКО начальный бэкофф
        // (30с), а не продолжать расти от прежнего значения.
        queue.add(envelope("b"))
        shouldFail = true
        clock.value = 30_001L
        transport.flush()

        clock.value = 30_001L + 29_000L // ещё меньше начального бэкоффа — не должно уйти
        transport.flush()
        assertEquals("сброшенный бэкофф не должен был позволить попытку раньше 30с", 3, attemptTimestamps.size)

        clock.value = 30_001L + 30_000L
        transport.flush()
        assertEquals(4, attemptTimestamps.size)
    }

    // ── батч целиком, а не одна запись за раз ────────────────────────────

    @Test
    fun `при полном успехе очередь опустошается пачкой без лишних вызовов sendBatch`() = runBlocking {
        val queue = MutableList(3) { envelope("id-$it") }
        var calls = 0
        val transport = AnalyticsTransport(
            isConsentGranted = { true },
            peekQueue = { limit -> queue.take(limit) },
            removeSent = { ids -> queue.removeAll { it.eventId in ids } },
            sendBatch = { batch -> calls++; batch.map { true } },
        )

        transport.flush()

        assertTrue(queue.isEmpty())
        assertEquals(1, calls)
    }
}
