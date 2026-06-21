package ru.cmpas.app.data.datastore

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.longPreferencesKey
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map
import javax.inject.Inject
import javax.inject.Singleton

private val Context.legalDataStore: DataStore<Preferences> by preferencesDataStore(name = "compas_legal_prefs")

@Singleton
class LegalPreferences @Inject constructor(
    @ApplicationContext private val context: Context,
) {
    companion object {
        private val TERMS_VERSION = stringPreferencesKey("terms_version")
        private val ADS_VERSION = stringPreferencesKey("ads_version")
        private val LAST_ADS_PROMPT_AT = longPreferencesKey("last_ads_prompt_at")
    }

    suspend fun saveTermsVersion(version: String) {
        context.legalDataStore.edit { prefs -> prefs[TERMS_VERSION] = version }
    }

    suspend fun getTermsVersion(): String? =
        context.legalDataStore.data.map { it[TERMS_VERSION] }.first()

    suspend fun saveAdsVersion(version: String) {
        context.legalDataStore.edit { prefs -> prefs[ADS_VERSION] = version }
    }

    suspend fun getAdsVersion(): String? =
        context.legalDataStore.data.map { it[ADS_VERSION] }.first()

    suspend fun markAdsPromptShown(atMillis: Long = System.currentTimeMillis()) {
        context.legalDataStore.edit { prefs -> prefs[LAST_ADS_PROMPT_AT] = atMillis }
    }

    suspend fun getLastAdsPromptAt(): Long =
        context.legalDataStore.data.map { it[LAST_ADS_PROMPT_AT] ?: 0L }.first()
}
