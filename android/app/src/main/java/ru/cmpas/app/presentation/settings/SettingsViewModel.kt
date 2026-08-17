package ru.cmpas.app.presentation.settings

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import retrofit2.Response
import ru.cmpas.app.data.api.CompasApi
import ru.cmpas.app.domain.model.DashboardDataV2
import ru.cmpas.app.domain.model.MobileLegalAcceptBody
import ru.cmpas.app.domain.model.MobileLegalStatus
import ru.cmpas.app.domain.model.User
import javax.inject.Inject

@HiltViewModel
class SettingsViewModel @Inject constructor(
    private val api: CompasApi,
) : ViewModel() {
    private val _uiState = MutableStateFlow(SettingsUiState())
    val uiState = _uiState.asStateFlow()

    init { refresh() }

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
)
