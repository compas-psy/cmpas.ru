package ru.cmpas.app.presentation.clients

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import ru.cmpas.app.data.api.CompasApi
import ru.cmpas.app.data.api.InviteRequest
import ru.cmpas.app.data.api.SendMessageRequest
import ru.cmpas.app.domain.model.Client
import ru.cmpas.app.domain.model.ClientDetail
import ru.cmpas.app.domain.model.ClientStatus
import ru.cmpas.app.domain.model.Session
import javax.inject.Inject

@HiltViewModel
class ClientDetailViewModel @Inject constructor(
    private val api: CompasApi,
) : ViewModel() {

    private val _uiState = MutableStateFlow(ClientDetailUiState())
    val uiState = _uiState.asStateFlow()

    fun loadClient(clientId: String) {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, error = null) }
            try {
                val clientResponse = api.getClient(clientId)
                val sessionsResponse = api.getSessions()
                if (clientResponse.isSuccessful) {
                    val detail = clientResponse.body()
                    val allSessions = sessionsResponse.body() ?: emptyList()
                    val clientSessions = allSessions.filter { it.clientId == clientId }
                    _uiState.update {
                        it.copy(
                            isLoading = false,
                            client = detail?.let { d ->
                                Client(
                                    id = d.id,
                                    name = d.name,
                                    email = d.email,
                                    phone = d.phone,
                                    telegramId = d.telegramId,
                                    sessionsCount = d.sessionsCount,
                                    lastSessionDate = d.lastSessionDate,
                                    status = d.status,
                                )
                            },
                            clientDetail = detail,
                            sessions = clientSessions,
                        )
                    }
                } else {
                    _uiState.update { it.copy(isLoading = false, error = "Клиент не найден") }
                }
            } catch (e: Exception) {
                _uiState.update { it.copy(isLoading = false, error = e.localizedMessage) }
            }
        }
    }

    /** Send arbitrary text or a reminder template to the client. */
    fun sendMessage(clientId: String, type: String, text: String? = null, sessionId: String? = null) {
        viewModelScope.launch {
            _uiState.update { it.copy(isSendingMessage = true, messageResult = null) }
            try {
                val r = api.sendMessage(clientId, SendMessageRequest(type = type, text = text, sessionId = sessionId))
                if (r.isSuccessful) {
                    val body = r.body()
                    _uiState.update {
                        it.copy(
                            isSendingMessage = false,
                            messageResult = if (body?.status == "manual")
                                MessageResult.Manual(body.readyText ?: "", body.phone)
                            else
                                MessageResult.Sent(body?.status ?: ""),
                        )
                    }
                } else {
                    _uiState.update { it.copy(isSendingMessage = false, messageResult = MessageResult.Error("Ошибка отправки")) }
                }
            } catch (e: Exception) {
                _uiState.update { it.copy(isSendingMessage = false, messageResult = MessageResult.Error(e.localizedMessage ?: "Ошибка")) }
            }
        }
    }

    /** Generate invite link for the client to connect Telegram/MAX. */
    fun generateInviteLink(clientId: String, channel: String = "telegram") {
        viewModelScope.launch {
            _uiState.update { it.copy(isGeneratingInvite = true) }
            try {
                val r = api.createInviteLink(clientId, InviteRequest(channel = channel))
                if (r.isSuccessful) {
                    _uiState.update { it.copy(isGeneratingInvite = false, inviteLink = r.body()?.inviteLink) }
                } else {
                    _uiState.update { it.copy(isGeneratingInvite = false) }
                }
            } catch (_: Exception) {
                _uiState.update { it.copy(isGeneratingInvite = false) }
            }
        }
    }

    fun clearMessageResult() = _uiState.update { it.copy(messageResult = null) }
    fun clearInviteLink() = _uiState.update { it.copy(inviteLink = null) }
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
    val error: String? = null,
    val isSendingMessage: Boolean = false,
    val messageResult: MessageResult? = null,
    val isGeneratingInvite: Boolean = false,
    val inviteLink: String? = null,
)
