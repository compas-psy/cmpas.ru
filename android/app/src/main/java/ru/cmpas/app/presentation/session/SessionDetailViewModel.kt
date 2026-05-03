package ru.cmpas.app.presentation.session

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import ru.cmpas.app.data.api.CompasApi
import ru.cmpas.app.data.api.UpdateSessionRequest
import ru.cmpas.app.domain.model.Session
import javax.inject.Inject

@HiltViewModel
class SessionDetailViewModel @Inject constructor(
    private val api: CompasApi,
) : ViewModel() {

    private val _uiState = MutableStateFlow(SessionDetailUiState())
    val uiState = _uiState.asStateFlow()

    fun loadSession(sessionId: String) {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, error = null) }
            try {
                // Use sessions list and find by id (no dedicated endpoint yet)
                val response = api.getSessions()
                if (response.isSuccessful) {
                    val session = response.body()?.find { it.id == sessionId }
                    _uiState.update {
                        it.copy(
                            isLoading = false,
                            session = session,
                            error = if (session == null) "Сессия не найдена" else null,
                        )
                    }
                } else {
                    _uiState.update { it.copy(isLoading = false, error = "Ошибка загрузки") }
                }
            } catch (e: Exception) {
                _uiState.update { it.copy(isLoading = false, error = e.localizedMessage) }
            }
        }
    }

    fun updateStatus(sessionId: String, status: String) {
        viewModelScope.launch {
            try {
                api.updateSession(sessionId, UpdateSessionRequest(status = ru.cmpas.app.domain.model.SessionStatus.valueOf(status.uppercase())))
                loadSession(sessionId)
            } catch (_: Exception) {}
        }
    }
}

data class SessionDetailUiState(
    val isLoading: Boolean = false,
    val session: Session? = null,
    val error: String? = null,
)
