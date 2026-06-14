package ru.cmpas.app.presentation.actions

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import ru.cmpas.app.data.api.CompasApi
import ru.cmpas.app.data.api.SendMessageRequest
import ru.cmpas.app.domain.model.OnboardingDoc
import ru.cmpas.app.domain.model.OnboardingResult
import ru.cmpas.app.domain.model.OnboardingSendRequest
import javax.inject.Inject

@HiltViewModel
class QuickCommsViewModel @Inject constructor(
    private val api: CompasApi,
) : ViewModel() {
    private val _uiState = MutableStateFlow(QuickCommsUiState())
    val uiState = _uiState.asStateFlow()

    fun loadDocuments(clientId: String) {
        viewModelScope.launch {
            _uiState.update { it.copy(clientId = clientId, loading = true, error = null) }
            try {
                val response = api.getOnboardingOptions(clientId)
                _uiState.update {
                    it.copy(
                        loading = false,
                        documents = if (response.isSuccessful) response.body()?.documents.orEmpty() else emptyList(),
                        error = if (response.isSuccessful) null else "Документы не загрузились",
                    )
                }
            } catch (_: Exception) {
                _uiState.update { it.copy(loading = false, documents = emptyList(), error = "Документы временно недоступны") }
            }
        }
    }

    fun sendMessage(clientId: String, text: String) {
        viewModelScope.launch {
            runCatching { api.sendMessage(clientId, SendMessageRequest(type = "custom", text = text)) }
        }
    }

    fun sendDocument(
        clientId: String,
        channel: String,
        documentId: String,
        callback: (OnboardingResult?, String?) -> Unit,
    ) {
        viewModelScope.launch {
            _uiState.update { it.copy(sending = true) }
            try {
                val response = api.sendOnboarding(
                    clientId,
                    OnboardingSendRequest(channel = channel, sendNotification = false, documentId = documentId),
                )
                _uiState.update { it.copy(sending = false) }
                if (response.isSuccessful) callback(response.body(), null)
                else callback(null, "Документ не отправлен")
            } catch (_: Exception) {
                _uiState.update { it.copy(sending = false) }
                callback(null, "Документ не отправлен")
            }
        }
    }
}

data class QuickCommsUiState(
    val clientId: String? = null,
    val loading: Boolean = false,
    val sending: Boolean = false,
    val documents: List<OnboardingDoc> = emptyList(),
    val error: String? = null,
)
