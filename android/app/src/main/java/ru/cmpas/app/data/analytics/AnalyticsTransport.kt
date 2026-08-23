package ru.cmpas.app.data.analytics

import ru.cmpas.app.data.api.AnalyticsEventEnvelope

/**
 * Довозит очередь [AnalyticsRecorder] до `POST /api/mobile/analytics`
 * пачками. Зависимости — suspend-лямбды, как у [AnalyticsRecorder]: сеть и
 * локальное хранилище здесь не видны вовсе, вся логика батчей/бэкоффа/
 * partial-failure проверяется юнит-тестами без Android. Реальную отправку
 * (Retrofit) собирает `AnalyticsModule`.
 *
 * ДВОЙНОЙ гейт согласия — вторая из двух независимых проверок (первая — в
 * [AnalyticsRecorder.record]): до [isConsentGranted] == true ни одного
 * вызова [sendBatch] не происходит, даже если в очереди уже что-то лежит
 * (например, согласие дали, потом отозвали до того, как flush успел
 * выполниться).
 *
 * [sendBatch] обязан различать ДВА разных отказа, а не сводить их к одному
 * булеву как в справочной реализации МОМЕНТОВ:
 *  - весь запрос не доехал или сервер ответил не 2xx/битым телом → `null`,
 *    ни одно событие не подтверждено, применяется бэкофф, очередь не трогаем;
 *  - HTTP 200 с `results[]` → список `accepted` **по каждому элементу
 *    отдельно**. `{accepted:false}` при HTTP 200 — это ОТКАЗ (контракт
 *    приёмника), а не успех: такое событие остаётся в очереди, а не
 *    удаляется, даже если запрос в целом дошёл успешно.
 */
class AnalyticsTransport(
    private val isConsentGranted: suspend () -> Boolean,
    private val peekQueue: suspend (limit: Int) -> List<AnalyticsEventEnvelope>,
    private val removeSent: suspend (eventIds: Set<String>) -> Unit,
    private val sendBatch: suspend (batch: List<AnalyticsEventEnvelope>) -> List<Boolean>?,
    private val now: () -> Long = System::currentTimeMillis,
) {
    private var nextAttemptAtMs = 0L
    private var backoffMs = INITIAL_BACKOFF_MS

    /** Отправляет пачками, пока очередь не опустеет или пока не встретится неполный успех. */
    suspend fun flush() {
        if (!isConsentGranted()) return
        if (now() < nextAttemptAtMs) return

        while (true) {
            val batch = peekQueue(BATCH_SIZE)
            if (batch.isEmpty()) {
                backoffMs = INITIAL_BACKOFF_MS
                return
            }

            val results = sendBatch(batch)
            if (results == null || results.size != batch.size) {
                // Весь запрос не доехал (сеть/HTTP/битое тело) — ни одно
                // событие не подтверждено, очередь остаётся как была.
                scheduleRetry()
                return
            }

            val acceptedIds = batch.zip(results)
                .filter { (_, accepted) -> accepted }
                .map { (envelope, _) -> envelope.eventId }
                .toSet()
            if (acceptedIds.isNotEmpty()) removeSent(acceptedIds)

            if (acceptedIds.size < batch.size) {
                // Partial failure: то, что осталось в очереди, попробуем
                // снова после бэкоффа — но подтверждённое уже удалено.
                scheduleRetry()
                return
            }

            backoffMs = INITIAL_BACKOFF_MS
            if (batch.size < BATCH_SIZE) return
        }
    }

    private fun scheduleRetry() {
        nextAttemptAtMs = now() + backoffMs
        backoffMs = (backoffMs * 2).coerceAtMost(MAX_BACKOFF_MS)
    }

    companion object {
        const val BATCH_SIZE = 20
        const val INITIAL_BACKOFF_MS = 30_000L
        const val MAX_BACKOFF_MS = 30 * 60_000L
    }
}
