package ru.cmpas.app.data.analytics

import ru.cmpas.app.data.api.AnalyticsConsentRequest
import ru.cmpas.app.data.api.CompasApi
import ru.cmpas.app.data.datastore.UserPreferences
import javax.inject.Inject
import javax.inject.Singleton

/** Состояние согласия, каким его видит остальное приложение (тумблер, Recorder, Transport). */
data class AnalyticsConsentState(val granted: Boolean, val since: String?)

/**
 * Согласие — обычный аутентифицированный РЕСУРС на сервере
 * (`GET`/`PUT /api/mobile/analytics/consent`), а не событие и не «карман» в
 * гейте ingest. Источник истины — сервер; [UserPreferences] здесь только
 * КЭШ для мгновенного и офлайн чтения (тумблеру и гейтам нужно что-то
 * ответить синхронно, до похода в сеть), а не альтернативная правда.
 *
 * СОГЛАСИЕ — КРАСНАЯ ЛИНИЯ, А НЕ ФУНКЦИЯ: пока кэш ни разу не был заполнен
 * подтверждённым ответом сервера — до логина, до первого [refresh], при
 * ошибке сети — [isGranted] возвращает false. Fail-closed, никогда
 * fail-open: отсутствие данных о согласии равносильно его отсутствию.
 */
@Singleton
class AnalyticsConsent @Inject constructor(
    private val api: CompasApi,
    private val prefs: UserPreferences,
) {

    /** Быстрая синхронная (по кэшу) проверка — её используют оба гейта: Recorder и Transport. */
    suspend fun isGranted(): Boolean = prefs.getAnalyticsConsentGranted() == true

    /** Последнее известное состояние из кэша — для немедленной отрисовки тумблера, ещё до сети. */
    suspend fun cached(): AnalyticsConsentState =
        AnalyticsConsentState(prefs.getAnalyticsConsentGranted() == true, prefs.getAnalyticsConsentSince())

    /**
     * Перечитывает согласие с сервера — источника истины — и обновляет
     * локальный кэш. Возвращает null при сетевой ошибке или неуспешном
     * ответе — в этом случае кэш НЕ трогаем (последнее известное состояние
     * остаётся в силе; не путать с fail-open — если кэша тоже никогда не
     * было, [isGranted] всё равно вернёт false).
     */
    suspend fun refresh(): AnalyticsConsentState? {
        val response = runCatching { api.getAnalyticsConsent() }.getOrNull()?.takeIf { it.isSuccessful }
            ?: return null
        val body = response.body() ?: return null
        prefs.setAnalyticsConsent(body.granted, body.since)
        return AnalyticsConsentState(body.granted, body.since)
    }

    /**
     * Пишет согласие на сервер. При успешном ОТЗЫВЕ (`granted == false`)
     * зовёт [onRevoked] — им вызывающая сторона обязана стереть локальную
     * очередь ещё не отправленных событий: отзыв обязан не только выключить
     * будущую запись, но и удалить уже собранное (см. `AnalyticsEventStore.clear()`);
     * удаление уже ушедших на сервер событий делает сам сервер (не эта функция).
     */
    suspend fun setGranted(granted: Boolean, onRevoked: suspend () -> Unit = {}): Result<AnalyticsConsentState> {
        val response = runCatching { api.setAnalyticsConsent(AnalyticsConsentRequest(granted)) }
            .getOrElse { return Result.failure(it) }
        if (!response.isSuccessful) return Result.failure(IllegalStateException("PUT analytics/consent: HTTP ${response.code()}"))
        val body = response.body() ?: return Result.failure(IllegalStateException("PUT analytics/consent: пустое тело"))
        prefs.setAnalyticsConsent(body.granted, body.since)
        if (!body.granted) onRevoked()
        return Result.success(AnalyticsConsentState(body.granted, body.since))
    }
}
