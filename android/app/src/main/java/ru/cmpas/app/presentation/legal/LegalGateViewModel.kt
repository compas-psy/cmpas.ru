package ru.cmpas.app.presentation.legal

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import ru.cmpas.app.data.api.CompasApi
import ru.cmpas.app.data.datastore.LegalPreferences
import ru.cmpas.app.domain.model.MobileLegalAcceptBody
import ru.cmpas.app.domain.model.MobileLegalDoc
import ru.cmpas.app.domain.model.MobileLegalStatus
import javax.inject.Inject

@HiltViewModel
class LegalGateViewModel @Inject constructor(
    private val api: CompasApi,
    private val preferences: LegalPreferences,
) : ViewModel() {
    private val _uiState = MutableStateFlow(LegalGateUiState())
    val uiState = _uiState.asStateFlow()

    init { loadStatus() }

    fun loadStatus() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, error = null) }
            try {
                val response = api.getLegalStatus()
                val status = if (response.isSuccessful) response.body() else null
                if (status == null) {
                    _uiState.update { it.copy(isLoading = false, error = "Не удалось проверить документы") }
                    return@launch
                }

                _uiState.update {
                    it.copy(
                        isLoading = false,
                        status = status,
                        termsRequired = status.requiresTermsAcceptance,
                        // Рекламное согласие показывается только рядом с обязательными
                        // документами. Отдельный блокирующий popup после принятия ПС/ПК
                        // не показываем: дособерём согласие позднее в настройках.
                        showAdsPrompt = false,
                        error = null,
                    )
                }
            } catch (_: Exception) {
                _uiState.update { it.copy(isLoading = false, error = "Документы проверим позже") }
            }
        }
    }

    fun acceptRequired(includeAds: Boolean) {
        val status = _uiState.value.status ?: return
        viewModelScope.launch {
            _uiState.update { it.copy(isSaving = true, error = null) }
            try {
                // 1. Сначала сохраняем только обязательные ПС и ПК.
                // Рекламное согласие не должно влиять на доступ к приложению.
                val requiredResponse = api.acceptLegal(
                    MobileLegalAcceptBody(
                        acceptTerms = true,
                        acceptAds = null,
                        documentIds = status.requiredDocumentIds,
                    ),
                )
                if (!requiredResponse.isSuccessful) throw IllegalStateException()

                status.terms?.let { preferences.saveTermsVersion(it.version) }

                // 2. Рекламное согласие — отдельный best-effort запрос.
                // Даже если он временно не сохранится, ПС/ПК уже приняты и gate закрывается.
                if (includeAds) {
                    val adsResponse = runCatching {
                        api.acceptLegal(MobileLegalAcceptBody(acceptAds = true))
                    }.getOrNull()
                    if (adsResponse?.isSuccessful == true) {
                        status.ads?.let { preferences.saveAdsVersion(it.version) }
                    }
                }

                // Не показываем сразу второй рекламный popup независимо от выбора.
                preferences.markAdsPromptShown()
                _uiState.update {
                    it.copy(
                        isSaving = false,
                        termsRequired = false,
                        showAdsPrompt = false,
                        error = null,
                    )
                }
                loadStatus()
            } catch (_: Exception) {
                _uiState.update { it.copy(isSaving = false, error = "Не удалось сохранить принятие ПС и политики конфиденциальности") }
            }
        }
    }

    fun acceptAds() {
        val ads = _uiState.value.status?.ads ?: return
        viewModelScope.launch {
            _uiState.update { it.copy(isSaving = true, error = null) }
            try {
                val response = api.acceptLegal(MobileLegalAcceptBody(acceptAds = true))
                if (!response.isSuccessful) throw IllegalStateException()
                preferences.saveAdsVersion(ads.version)
                _uiState.update { it.copy(isSaving = false, showAdsPrompt = false) }
                loadStatus()
            } catch (_: Exception) {
                _uiState.update { it.copy(isSaving = false, error = "Не удалось сохранить согласие") }
            }
        }
    }

    fun dismissAdsPrompt() {
        viewModelScope.launch {
            preferences.markAdsPromptShown()
            _uiState.update { it.copy(showAdsPrompt = false) }
        }
    }
}

data class LegalGateUiState(
    val isLoading: Boolean = false,
    val isSaving: Boolean = false,
    val status: MobileLegalStatus? = null,
    val termsRequired: Boolean = false,
    val showAdsPrompt: Boolean = false,
    val error: String? = null,
) {
    val terms: MobileLegalDoc? get() = status?.terms
    val privacy: MobileLegalDoc? get() = status?.privacy
    val ads: MobileLegalDoc? get() = status?.ads
}
