package ru.cmpas.app.data.analytics

import kotlinx.serialization.json.JsonElement
import ru.cmpas.app.data.api.AnalyticsEventEnvelope
import java.time.Instant
import java.util.UUID

/** `to` у session_status_changed — ровно те четыре значения, что в analytics/schema/events.yaml. Клиент не выдумывает свои. */
enum class SessionStatusTarget(internal val wireValue: String) {
    CONFIRMED("confirmed"),
    COMPLETED("completed"),
    CANCELLED("cancelled"),
    RESCHEDULED("rescheduled"),
}

/** `mode` у session_note_saved. */
enum class NoteMode(internal val wireValue: String) {
    SHORT("short"),
    BLOCKS("blocks"),
}

/** `channel` у client_invite_created. */
enum class InviteChannel(internal val wireValue: String) {
    TELEGRAM("telegram"),
    MAX("max"),
    AUTO("auto"),
}

/** `days_ahead_bucket` у session_created. */
enum class DaysAheadBucket(internal val wireValue: String) {
    PAST("past"),
    SAME_DAY("same_day"),
    WITHIN_WEEK("within_week"),
    WITHIN_MONTH("within_month"),
    LATER("later"),
}

/** `since_session_bucket` у session_note_saved. */
enum class SinceSessionBucket(internal val wireValue: String) {
    BEFORE_SESSION("before_session"),
    SAME_DAY("same_day"),
    NEXT_DAY("next_day"),
    WITHIN_WEEK("within_week"),
    LATER("later"),
}

/**
 * Единственная публичная точка записи аналитики ПРАКТИКИ-мобайла — ровно
 * семь suspend-функций, по одной на каждое событие из
 * `analytics/schema/events.yaml`. Универсального `record(name, props)`
 * наружу нет намеренно: место вызова (экран, ViewModel) не может ни
 * придумать восьмое имя события, ни передать в него произвольное свойство —
 * единственный способ отправить что-либо отсюда — вызвать одну из этих
 * функций с типизированными параметрами.
 *
 * Зависимости — suspend-лямбды, а не конкретные классы: так класс
 * проверяется юнит-тестами без Android/DataStore/Hilt/Retrofit.
 * `AnalyticsModule` подключает сюда настоящие [AnalyticsConsent] и
 * [ru.cmpas.app.data.local.AnalyticsEventStore].
 *
 * ДВОЙНОЙ гейт согласия — это первая из двух независимых проверок (вторая —
 * в [AnalyticsTransport.flush]): пока [isConsentGranted] не вернёт true, ни
 * один record* не имеет побочного эффекта — событие даже не строится, не
 * говоря уже о постановке в очередь.
 */
class AnalyticsRecorder(
    private val isConsentGranted: suspend () -> Boolean,
    private val enqueue: suspend (AnalyticsEventEnvelope) -> Unit,
    private val eventId: () -> String = { UUID.randomUUID().toString() },
    private val now: () -> Instant = Instant::now,
) {

    suspend fun recordAppOpened(firstLaunch: Boolean? = null) = record(
        "app_opened",
        buildMap {
            put("surface", jsonOf(SURFACE))
            firstLaunch?.let { put("first_launch", jsonOf(it)) }
        },
    )

    suspend fun recordSessionCreated(
        delivered: Boolean,
        repeatBatch: Boolean? = null,
        daysAheadBucket: DaysAheadBucket? = null,
    ) = record(
        "session_created",
        buildMap {
            put("surface", jsonOf(SURFACE))
            put("delivered", jsonOf(delivered))
            repeatBatch?.let { put("repeat_batch", jsonOf(it)) }
            daysAheadBucket?.let { put("days_ahead_bucket", jsonOf(it.wireValue)) }
        },
    )

    suspend fun recordSessionStatusChanged(to: SessionStatusTarget, delivered: Boolean) = record(
        "session_status_changed",
        mapOf(
            "surface" to jsonOf(SURFACE),
            "to" to jsonOf(to.wireValue),
            "delivered" to jsonOf(delivered),
        ),
    )

    suspend fun recordSessionNoteSaved(
        delivered: Boolean,
        mode: NoteMode,
        blocksFilled: Int? = null,
        sinceSessionBucket: SinceSessionBucket? = null,
    ) = record(
        "session_note_saved",
        buildMap {
            put("surface", jsonOf(SURFACE))
            put("delivered", jsonOf(delivered))
            put("mode", jsonOf(mode.wireValue))
            // Клампится на границе, а не отбрасывается: -1 или 8 — не «нет
            // значения», это ошибка вызывающего кода в счёте, которую не
            // стоит терять целиком.
            blocksFilled?.let { put("blocks_filled", jsonOf(it.coerceIn(0, 5))) }
            sinceSessionBucket?.let { put("since_session_bucket", jsonOf(it.wireValue)) }
        },
    )

    suspend fun recordSessionNoteAbandoned(hadInput: Boolean) = record(
        "session_note_abandoned",
        mapOf(
            "surface" to jsonOf(SURFACE),
            "had_input" to jsonOf(hadInput),
        ),
    )

    suspend fun recordClientCreated(delivered: Boolean) = record(
        "client_created",
        mapOf(
            "surface" to jsonOf(SURFACE),
            "delivered" to jsonOf(delivered),
        ),
    )

    suspend fun recordClientInviteCreated(channel: InviteChannel, delivered: Boolean) = record(
        "client_invite_created",
        mapOf(
            "surface" to jsonOf(SURFACE),
            "channel" to jsonOf(channel.wireValue),
            "delivered" to jsonOf(delivered),
        ),
    )

    private suspend fun record(name: String, props: Map<String, JsonElement>) {
        if (!isConsentGranted()) return
        val envelope = buildAnalyticsEvent(name, props, now().toString(), eventId()) ?: return
        enqueue(envelope)
    }
}
