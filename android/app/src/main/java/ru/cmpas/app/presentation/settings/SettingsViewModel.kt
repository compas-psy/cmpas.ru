package ru.cmpas.app.presentation.settings

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import retrofit2.Response
import ru.cmpas.app.data.analytics.AnalyticsConsent
import ru.cmpas.app.data.api.CompasApi
import ru.cmpas.app.data.local.AnalyticsEventStore
import ru.cmpas.app.domain.model.DashboardDataV2
import ru.cmpas.app.domain.model.MobileLegalAcceptBody
import ru.cmpas.app.domain.model.MobileLegalStatus
import ru.cmpas.app.domain.model.User
import javax.inject.Inject

@HiltViewModel
class SettingsViewModel @Inject constructor(
    private val api: CompasApi,
    private val analyticsConsent: AnalyticsConsent,
    private val analyticsEventStore: AnalyticsEventStore,
) : ViewModel() {
    private val _uiState = MutableStateFlow(SettingsUiState())
    val uiState = _uiState.asStateFlow()

    init {
        refresh()
        loadAnalyticsConsent()
    }

    /**
     * Тумблер обязан сначала показать последнее известное состояние из
     * локального кэша (мгновенно, офлайн), а затем — актуальное состояние с
     * сервера, который остаётся источником истины. Кэш выключен по
     * умолчанию (см. AnalyticsConsent), поэтому до первого успешного ответа
     * сети тумблер честно показывает «выключено», а не зависает пустым.
     */
    fun loadAnalyticsConsent() {
        viewModelScope.launch {
            val cached = analyticsConsent.cached()
            _uiState.update { it.copy(analyticsConsentGranted = cached.granted) }
            analyticsConsent.refresh()?.let { fresh ->
                _uiState.update { it.copy(analyticsConsentGranted = fresh.granted) }
            }
        }
    }

    /**
     * Пишет согласие через ресурс `PUT /api/mobile/analytics/consent`. При
     * отзыве очищает и локальную очередь ещё не отправленных событий — отзыв
     * обязан не только остановить сбор, но и удалить уже собранное.
     */
    fun setAnalyticsConsent(granted: Boolean) {
        viewModelScope.launch {
            _uiState.update { it.copy(isSavingAnalyticsConsent = true, error = null) }
            analyticsConsent.setGranted(granted, onRevoked = { analyticsEventStore.clear() })
                .onSuccess { state ->
                    _uiState.update { it.copy(isSavingAnalyticsConsent = false, analyticsConsentGranted = state.granted) }
                }
                .onFailure {
                    _uiState.update { it.copy(isSavingAnalyticsConsent = false, error = "Не удалось обновить согласие на аналитику") }
                }
        }
    }

    fun refresh() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, error = null) }
            try {
                val profileResponse = api.getProfile()
                val legalResponse = api.getLegalStatus()
                val dashboardResponse = runCatching { api.getDashboard() }.getOrNull()
                _uiState.update {
                    it.copy(
                        isLoading = false,
                        user = if (profileResponse.isSuccessful) profileResponse.body() else it.user,
                        legalStatus = if (legalResponse.isSuccessful) legalResponse.body() else it.legalStatus,
                        bookingLink = mergeBookingLink(dashboardResponse, it.bookingLink),
                        error = if (!legalResponse.isSuccessful) "Не удалось загрузить документы" else null,
                    )
                }
            } catch (_: Exception) {
                _uiState.update { it.copy(isLoading = false, error = "Ошибка подключения") }
            }
        }
    }

    fun acceptRequiredDocuments() {
        val status = _uiState.value.legalStatus ?: return
        viewModelScope.launch {
            _uiState.update { it.copy(isSavingLegal = true, error = null) }
            try {
                val response = api.acceptLegal(
                    MobileLegalAcceptBody(acceptTerms = true, documentIds = status.requiredDocumentIds),
                )
                if (!response.isSuccessful) throw IllegalStateException()
                _uiState.update { it.copy(isSavingLegal = false) }
                refresh()
            } catch (_: Exception) {
                _uiState.update { it.copy(isSavingLegal = false, error = "Не удалось сохранить документы") }
            }
        }
    }

    fun setAdsConsent(accepted: Boolean) {
        viewModelScope.launch {
            _uiState.update { it.copy(isSavingLegal = true, error = null) }
            try {
                val response = api.acceptLegal(MobileLegalAcceptBody(acceptAds = accepted))
                if (!response.isSuccessful) throw IllegalStateException()
                _uiState.update { it.copy(isSavingLegal = false) }
                refresh()
            } catch (_: Exception) {
                _uiState.update { it.copy(isSavingLegal = false, error = "Не удалось обновить согласие") }
            }
        }
    }
}

/** Keeps the previously known booking link if the dashboard call failed or came back empty. */
internal fun mergeBookingLink(dashboardResponse: Response<DashboardDataV2>?, previous: String?): String? =
    dashboardResponse?.takeIf { it.isSuccessful }?.body()?.bookingLink ?: previous

data class SettingsUiState(
    val isLoading: Boolean = false,
    val isSavingLegal: Boolean = false,
    val user: User? = null,
    val legalStatus: MobileLegalStatus? = null,
    val bookingLink: String? = null,
    val error: String? = null,
    // Выключено по умолчанию (fail-closed) — до ответа сервера тумблер не
    // показывает согласие включённым только потому, что состояние ещё не
    // загружено.
    val analyticsConsentGranted: Boolean = false,
    val isSavingAnalyticsConsent: Boolean = false,
)
