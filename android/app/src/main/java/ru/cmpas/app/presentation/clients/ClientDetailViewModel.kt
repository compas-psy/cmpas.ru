package ru.cmpas.app.presentation.clients

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import ru.cmpas.app.data.api.CompasApi
import ru.cmpas.app.data.api.InviteRequest
import ru.cmpas.app.data.api.SendMessageRequest
import ru.cmpas.app.domain.model.Client
import ru.cmpas.app.domain.model.ClientDetail
import ru.cmpas.app.domain.model.OnboardingDoc
import ru.cmpas.app.domain.model.OnboardingResult
import ru.cmpas.app.domain.model.OnboardingSendRequest
import ru.cmpas.app.domain.model.Session
import ru.cmpas.app.presentation.util.PracticeRefreshBus
import javax.inject.Inject

@HiltViewModel
class ClientDetailViewModel @Inject constructor(
    private val api: CompasApi,
) : ViewModel() {
    private val _uiState = MutableStateFlow(ClientDetailUiState())
    val uiState = _uiState.asStateFlow()
    private var loadedClientId: String? = null

    init {
        viewModelScope.launch {
            PracticeRefreshBus.changes.collectLatest {
                loadedClientId?.let { loadClient(it, false) }
            }
        }
    }

    fun loadClient(clientId: String, showLoader: Boolean = true) {
        loadedClientId = clientId
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = showLoader && it.client == null, error = null) }
            try {
                val response = api.getClient(clientId)
                if (!response.isSuccessful) {
                    _uiState.update { it.copy(isLoading = false, error = "Клиент не найден") }
                    return@launch
                }
                val detail = response.body()
                val remoteSessions = runCatching { api.getSessions() }.getOrNull()
                    ?.takeIf { it.isSuccessful }?.body().orEmpty()
                    .filter { it.clientId == clientId }
                _uiState.update {
                    it.copy(
                        isLoading = false,
                        client = detail?.toClient(),
                        clientDetail = detail,
                        sessions = remoteSessions.ifEmpty { detail?.recentSessions.orEmpty() },
                    )
                }
                loadDocuments(clientId)
            } catch (error: Exception) {
                _uiState.update { it.copy(isLoading = false, error = error.localizedMessage ?: "Не удалось загрузить клиента") }
            }
        }
    }

    fun loadDocuments(clientId: String? = loadedClientId) {
        val id = clientId ?: return
        viewModelScope.launch {
            _uiState.update { it.copy(isLoadingDocuments = true, documentsError = null) }
            runCatching { api.getOnboardingOptions(id) }
                .onSuccess { response ->
                    _uiState.update {
                        it.copy(
                            isLoadingDocuments = false,
                            documents = if (response.isSuccessful) response.body()?.documents.orEmpty() else emptyList(),
                            documentsError = if (response.isSuccessful) null else "Не удалось загрузить документы",
                        )
                    }
                }
                .onFailure {
                    _uiState.update { it.copy(isLoadingDocuments = false, documents = emptyList(), documentsError = "Документы временно недоступны") }
                }
        }
    }

    fun sendDocument(clientId: String, channel: String, documentId: String, callback: (OnboardingResult?, String?) -> Unit) {
        viewModelScope.launch {
            _uiState.update { it.copy(isSendingDocument = true) }
            val response = runCatching {
                api.sendOnboarding(clientId, OnboardingSendRequest(channel, false, documentId))
            }.getOrNull()
            _uiState.update { it.copy(isSendingDocument = false) }
            if (response?.isSuccessful == true) callback(response.body(), null)
            else callback(null, "Не удалось отправить документ")
        }
    }

    fun sendMessage(clientId: String, type: String, text: String? = null, sessionId: String? = null) {
        viewModelScope.launch {
            val response = runCatching {
                api.sendMessage(clientId, SendMessageRequest(type, text, sessionId))
            }.getOrNull()
            val body = response?.body()
            _uiState.update {
                it.copy(
                    messageResult = when {
                        response?.isSuccessful != true -> MessageResult.Error("Ошибка отправки")
                        body?.status == "manual" -> MessageResult.Manual(body.readyText.orEmpty(), body.phone)
                        else -> MessageResult.Sent(body?.status.orEmpty())
                    },
                )
            }
        }
    }

    fun generateInviteLink(clientId: String, channel: String = "auto") {
        viewModelScope.launch {
            val response = runCatching { api.createInviteLink(clientId, InviteRequest(channel)) }.getOrNull()
            _uiState.update { it.copy(inviteLink = response?.takeIf { result -> result.isSuccessful }?.body()?.inviteLink) }
        }
    }

    fun clearMessageResult() = _uiState.update { it.copy(messageResult = null) }
    fun clearInviteLink() = _uiState.update { it.copy(inviteLink = null) }

    private fun ClientDetail.toClient() = Client(
        id = id,
        name = name,
        email = email,
        phone = phone,
        gender = gender,
        telegramId = telegramId,
        maxId = maxId,
        sessionsCount = sessionsCount,
        lastSessionDate = lastSessionDate,
        status = status,
    )
}

sealed class MessageResult {
    data class Sent(val channel: String) : MessageResult()
    data class Manual(val readyText: String, val phone: String?) : MessageResult()
    data class Error(val message: String) : MessageResult()
}

data class ClientDetailUiState(
    val isLoading: Boolean = false,
    val client: Client? = null,
    val clientDetail: ClientDetail? = null,
    val sessions: List<Session> = emptyList(),
    val documents: List<OnboardingDoc> = emptyList(),
    val isLoadingDocuments: Boolean = false,
    val isSendingDocument: Boolean = false,
    val documentsError: String? = null,
    val error: String? = null,
    val messageResult: MessageResult? = null,
    val inviteLink: String? = null,
)
