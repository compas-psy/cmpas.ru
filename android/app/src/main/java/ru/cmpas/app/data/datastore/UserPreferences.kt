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
