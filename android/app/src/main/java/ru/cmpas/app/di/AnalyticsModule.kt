package ru.cmpas.app.di

import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import ru.cmpas.app.data.analytics.AnalyticsConsent
import ru.cmpas.app.data.analytics.AnalyticsRecorder
import ru.cmpas.app.data.analytics.AnalyticsTransport
import ru.cmpas.app.data.api.AnalyticsEventEnvelope
import ru.cmpas.app.data.api.CompasApi
import ru.cmpas.app.data.local.AnalyticsEventStore
import javax.inject.Singleton

/**
 * Собирает [AnalyticsRecorder] и [AnalyticsTransport] из suspend-лямбд.
 * Оба класса нарочно ничего не знают ни про Hilt, ни про Android, ни про
 * Retrofit напрямую — они проверяются юнит-тестами без всего этого; здесь
 * их лямбды подключаются к настоящим [AnalyticsConsent], [AnalyticsEventStore]
 * и [CompasApi].
 *
 * ДВОЙНОЙ гейт согласия виден прямо тут: `consent::isGranted` передаётся
 * И в Recorder, И в Transport — двумя отдельными вызовами, а не одним общим
 * флагом, который можно было бы забыть проверить в одном из двух мест.
 */
@Module
@InstallIn(SingletonComponent::class)
object AnalyticsModule {

    @Provides
    @Singleton
    fun provideAnalyticsRecorder(
        consent: AnalyticsConsent,
        store: AnalyticsEventStore,
    ): AnalyticsRecorder = AnalyticsRecorder(
        isConsentGranted = consent::isGranted,
        enqueue = { envelope -> store.enqueue(envelope) },
    )

    @Provides
    @Singleton
    fun provideAnalyticsTransport(
        consent: AnalyticsConsent,
        store: AnalyticsEventStore,
        api: CompasApi,
    ): AnalyticsTransport = AnalyticsTransport(
        isConsentGranted = consent::isGranted,
        peekQueue = { limit -> store.peek(limit) },
        removeSent = { ids -> store.removeByEventIds(ids) },
        sendBatch = { batch -> sendAnalyticsBatch(api, batch) },
    )
}

/**
 * null означает «весь запрос не доехал» (сеть/HTTP/битое или неполное
 * тело) — [AnalyticsTransport] в этом случае не удаляет из очереди ничего
 * и применяет бэкофф. Список `results[i].accepted` разбирается поэлементно:
 * `{accepted:false}` при HTTP 200 — это отказ приёмника, а не успех
 * (контракт приёмника, п. «отказ приходит при HTTP 200»), и не должен
 * трактоваться как повод удалить событие из очереди.
 */
private suspend fun sendAnalyticsBatch(api: CompasApi, batch: List<AnalyticsEventEnvelope>): List<Boolean>? {
    val response = runCatching { api.postAnalyticsEvents(batch) }.getOrElse { return null }
    if (!response.isSuccessful) return null
    val results = response.body()?.results ?: return null
    if (results.size != batch.size) return null
    return results.map { it.accepted }
}
