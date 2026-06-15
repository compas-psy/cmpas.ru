package ru.cmpas.app.presentation.session

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import ru.cmpas.app.data.api.CompasApi
import ru.cmpas.app.data.api.SendMessageRequest
import ru.cmpas.app.data.api.UpdateSessionRequest
import ru.cmpas.app.domain.model.ClientDetail
import ru.cmpas.app.domain.model.ReminderStatus
import ru.cmpas.app.domain.model.Session
import ru.cmpas.app.domain.model.SessionReminder
import ru.cmpas.app.domain.model.SessionStatus
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
                val response = api.getSession(sessionId)
                if (response.isSuccessful) {
                    val session = response.body()
                    val clientDetail = session?.let { current ->
                        runCatching {
                            val clientResponse = api.getClient(current.clientId)
                            if (clientResponse.isSuccessful) clientResponse.body() else null
                        }.getOrNull()
                    }
                    val bound = clientDetail?.hasMessenger == true
                    val reminders = session?.let { buildReminders(it, bound) }.orEmpty()
                    _uiState.update {
                        it.copy(
                            isLoading = false,
                            session = session,
                            clientDetail = clientDetail,
                            reminders = reminders,
                        )
                    }
                } else {
                    _uiState.update { it.copy(isLoading = false, error = "Сессия не найдена") }
                }
            } catch (e: Exception) {
                _uiState.update { it.copy(isLoading = false, error = e.localizedMessage) }
            }
        }
    }

    fun sendMessage(clientId: String, sessionId: String, text: String) {
        viewModelScope.launch {
            runCatching {
                api.sendMessage(
                    clientId,
                    SendMessageRequest(type = "custom", text = text, sessionId = sessionId),
                )
            }
        }
    }

    /** TODO API: заменить локальное состояние на endpoint повторной отправки. */
    fun resendReminder(sessionId: String, reminderId: String) {
        _uiState.update { state ->
            state.copy(reminders = state.reminders.map {
                if (it.id == reminderId) it.copy(status = ReminderStatus.SENT) else it
            })
        }
    }

    fun confirm(sessionId: String) {
        viewModelScope.launch {
            _uiState.update { it.copy(isActionLoading = true, actionError = null) }
            try {
                val response = api.updateSession(sessionId, UpdateSessionRequest(status = SessionStatus.CONFIRMED))
                if (response.isSuccessful) {
                    _uiState.update { it.copy(isActionLoading = false, session = response.body()) }
                    PracticeRefreshBus.notifyChanged()
                } else {
                    _uiState.update { it.copy(isActionLoading = false, actionError = "Ошибка подтверждения") }
                }
            } catch (e: Exception) {
                _uiState.update { it.copy(isActionLoading = false, actionError = e.localizedMessage) }
            }
        }
    }

    fun complete(sessionId: String) {
        viewModelScope.launch {
            _uiState.update { it.copy(isActionLoading = true, actionError = null) }
            try {
                val response = api.updateSession(sessionId, UpdateSessionRequest(status = SessionStatus.COMPLETED))
                if (response.isSuccessful) {
                    _uiState.update { it.copy(isActionLoading = false, session = response.body()) }
                    PracticeRefreshBus.notifyChanged()
                } else {
                    _uiState.update { it.copy(isActionLoading = false, actionError = "Ошибка") }
                }
            } catch (e: Exception) {
                _uiState.update { it.copy(isActionLoading = false, actionError = e.localizedMessage) }
            }
        }
    }

    fun cancel(sessionId: String) {
        viewModelScope.launch {
            _uiState.update { it.copy(isActionLoading = true, actionError = null) }
            try {
                val response = api.cancelSession(sessionId)
                if (response.isSuccessful) {
                    _uiState.update { it.copy(isActionLoading = false, cancelled = true) }
                    PracticeRefreshBus.notifyChanged()
                } else {
                    _uiState.update { it.copy(isActionLoading = false, actionError = "Ошибка отмены") }
                }
            } catch (e: Exception) {
                _uiState.update { it.copy(isActionLoading = false, actionError = e.localizedMessage) }
            }
        }
    }

    fun loadFreeTimes(date: String) {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoadingFreeTimes = true, freeTimesError = null, freeTimes = emptyList()) }
            try {
                val sessionId = _uiState.value.session?.id
                val r = api.getFreeTimes(date = date, sessionId = sessionId)
                if (r.isSuccessful) {
                    _uiState.update { it.copy(isLoadingFreeTimes = false, freeTimes = r.body()?.times.orEmpty()) }
                } else {
                    _uiState.update { it.copy(isLoadingFreeTimes = false, freeTimesError = "Нет доступных слотов") }
                }
            } catch (e: Exception) {
                _uiState.update { it.copy(isLoadingFreeTimes = false, freeTimesError = e.localizedMessage) }
            }
        }
    }

    fun reschedule(sessionId: String, newDate: String, newTime: String) {
        viewModelScope.launch {
            _uiState.update { it.copy(isActionLoading = true, actionError = null) }
            try {
                val r = api.updateSession(sessionId, UpdateSessionRequest(date = newDate, startTime = newTime))
                if (r.isSuccessful) {
                    _uiState.update {
                        it.copy(
                            isActionLoading = false,
                            session = r.body(),
                            showRescheduleDialog = false,
                        )
                    }
                } else {
                    _uiState.update { it.copy(isActionLoading = false, actionError = "Время уже занято") }
                }
            } catch (e: Exception) {
                _uiState.update { it.copy(isActionLoading = false, actionError = e.localizedMessage) }
            }
        }
    }

    fun openRescheduleDialog() = _uiState.update { it.copy(showRescheduleDialog = true, freeTimes = emptyList(), freeTimesError = null) }
    fun closeRescheduleDialog() = _uiState.update { it.copy(showRescheduleDialog = false) }
    fun clearActionError() = _uiState.update { it.copy(actionError = null) }

    fun updateStatus(sessionId: String, status: String) {
        when (status.uppercase()) {
            "CONFIRMED" -> confirm(sessionId)
            "COMPLETED" -> complete(sessionId)
            "CANCELLED" -> cancel(sessionId)
        }
    }
}

data class SessionDetailUiState(
    val isLoading: Boolean = false,
    val session: Session? = null,
    val clientDetail: ClientDetail? = null,
    val error: String? = null,
    val isActionLoading: Boolean = false,
    val actionError: String? = null,
    val cancelled: Boolean = false,
    val showRescheduleDialog: Boolean = false,
    val isLoadingFreeTimes: Boolean = false,
    val freeTimes: List<String> = emptyList(),
    val freeTimesError: String? = null,
    val reminders: List<SessionReminder> = emptyList(),
)
