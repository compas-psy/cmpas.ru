package ru.cmpas.app.presentation.clients

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import ru.cmpas.app.data.api.CompasApi
import ru.cmpas.app.domain.model.Client
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
                    val client = clientResponse.body()
                    val allSessions = sessionsResponse.body() ?: emptyList()
                    val clientSessions = allSessions.filter { it.clientId == clientId }
                    _uiState.update {
                        it.copy(
                            isLoading = false,
                            client = client,
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
}

data class ClientDetailUiState(
    val isLoading: Boolean = false,
    val client: Client? = null,
    val sessions: List<Session> = emptyList(),
    val error: String? = null,
)
