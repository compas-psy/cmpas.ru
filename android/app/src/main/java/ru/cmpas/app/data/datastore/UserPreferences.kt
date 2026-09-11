package ru.cmpas.app.data.datastore

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map
import javax.inject.Inject
import javax.inject.Singleton

private val Context.dataStore: DataStore<Preferences> by preferencesDataStore(name = "compas_prefs")

@Singleton
class UserPreferences @Inject constructor(
    @ApplicationContext private val context: Context,
) {
    companion object {
        private val ACCESS_TOKEN = stringPreferencesKey("access_token")
        private val REFRESH_TOKEN = stringPreferencesKey("refresh_token")
        private val USER_ID = stringPreferencesKey("user_id")
        private val USER_ROLE = stringPreferencesKey("user_role")

        // Кэш согласия на аналитику — НЕ источник истины (им остаётся сервер,
        // ru.cmpas.app.data.analytics.AnalyticsConsent). Нужен только чтобы
        // тумблер в настройках и AnalyticsRecorder/AnalyticsTransport могли
        // мгновенно и офлайн прочитать последнее известное состояние.
        private val ANALYTICS_CONSENT_GRANTED = booleanPreferencesKey("analytics_consent_granted")
        private val ANALYTICS_CONSENT_SINCE = stringPreferencesKey("analytics_consent_since")

        // КЛЮЧ ДОСТУПА СИМПАС — не тот же, что ключ ПРАКТИКИ.
        //
        // Нужен ровно для одного: сказать СИМПАС, что человек принял Особые
        // условия ПРАКТИКИ (PUT /v1/account/consents). Своего хранения
        // акцепта у продукта нет и быть не должно — запись о согласии живёт
        // в консент-центре, у нас только ключ, которым мы её туда кладём.
        //
        // Ключ живёт рядом с нашим, в том же незашифрованном DataStore. Это
        // не лучше, чем есть: рецепт СИМПАС советует EncryptedSharedPreferences
        // поверх Keystore и прямо говорит, что у нас сегодня не так. Класть
        // чужой ключ в более слабое место, чем свой, было бы отдельной
        // ошибкой; класть в такое же — это ровно тот долг, что уже есть, и он
        // назван в docs/integration/practice-android.md, шаг 5.
        private val SIMPASID_ACCESS_TOKEN = stringPreferencesKey("simpasid_access_token")
        private val SIMPASID_ACCOUNT_ID = stringPreferencesKey("simpasid_account_id")
        private val DEVICE_KEY = stringPreferencesKey("device_key")
    }

    /**
     * Ключ доступа СИМПАС и идентификатор учётной записи в ней.
     *
     * Пусто означает, что человек вошёл прежним способом — через нашу
     * почту или через Яндекс. Тогда акцепт Особых условий отправлять
     * НЕКУДА: учётной записи в СИМПАС у него может не быть вовсе.
     */
    suspend fun saveSimpasIdSession(accessToken: String, accountId: String) {
        context.dataStore.edit { prefs ->
            prefs[SIMPASID_ACCESS_TOKEN] = accessToken
            prefs[SIMPASID_ACCOUNT_ID] = accountId
        }
    }

    suspend fun getSimpasIdAccessToken(): String? =
        context.dataStore.data.map { it[SIMPASID_ACCESS_TOKEN] }.first()

    suspend fun getSimpasIdAccountId(): String? =
        context.dataStore.data.map { it[SIMPASID_ACCOUNT_ID] }.first()

    /**
     * Постоянный для УСТАНОВКИ случайный ключ устройства.
     *
     * Ни IMEI, ни ANDROID_ID, ни рекламный идентификатор: они переживают
     * переустановку и опознают ЧЕЛОВЕКА, а не установку
     * (docs/integration/practice-android.md, шаг 3). Здесь же он и рождается —
     * при первом обращении, и живёт ровно столько, сколько живёт установка.
     */
    suspend fun getOrCreateDeviceKey(): String {
        val existing = context.dataStore.data.map { it[DEVICE_KEY] }.first()
        if (existing != null) return existing
        val fresh = java.util.UUID.randomUUID().toString()
        context.dataStore.edit { prefs -> prefs[DEVICE_KEY] = fresh }
        return fresh
    }

    suspend fun saveTokens(accessToken: String, refreshToken: String) {
        context.dataStore.edit { prefs ->
            prefs[ACCESS_TOKEN] = accessToken
            prefs[REFRESH_TOKEN] = refreshToken
        }
    }

    suspend fun getAccessToken(): String? =
        context.dataStore.data.map { it[ACCESS_TOKEN] }.first()

    suspend fun getRefreshToken(): String? =
        context.dataStore.data.map { it[REFRESH_TOKEN] }.first()

    suspend fun saveUser(userId: String, role: String) {
        context.dataStore.edit { prefs ->
            prefs[USER_ID] = userId
            prefs[USER_ROLE] = role
        }
    }

    suspend fun getUserId(): String? =
        context.dataStore.data.map { it[USER_ID] }.first()

    suspend fun isLoggedIn(): Boolean =
        getAccessToken() != null

    suspend fun clear() {
        context.dataStore.edit { it.clear() }
    }

    /** Пишет последнее известное согласие с сервера в локальный кэш. */
    suspend fun setAnalyticsConsent(granted: Boolean, since: String?) {
        context.dataStore.edit { prefs ->
            prefs[ANALYTICS_CONSENT_GRANTED] = granted
            if (since != null) prefs[ANALYTICS_CONSENT_SINCE] = since else prefs.remove(ANALYTICS_CONSENT_SINCE)
        }
    }

    /** null — кэш ни разу не заполнялся сервером (до логина, до первого refresh, при ошибке сети). */
    suspend fun getAnalyticsConsentGranted(): Boolean? =
        context.dataStore.data.map { it[ANALYTICS_CONSENT_GRANTED] }.first()

    suspend fun getAnalyticsConsentSince(): String? =
        context.dataStore.data.map { it[ANALYTICS_CONSENT_SINCE] }.first()
}
