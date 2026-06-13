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
                    if (session == null) {
                        _uiState.update { it.copy(isLoading = false, error = "Сессия не найдена") }
                        return@launch
                    }

                    val client = runCatching {
                        val clientResponse = api.getClient(session.clientId)
                        if (clientResponse.isSuccessful) clientResponse.body() else null
                    }.getOrNull()
                    val bound = client?.hasMessenger == true
                    val channel = client?.messengerChannel ?: "telegram"
                    val reminders = buildReminders(session, bound).map { it.copy(channel = channel) }

                    _uiState.update {
                        it.copy(
                            isLoading = false,
                            session = session,
                            reminders = reminders,
                            hasMessenger = bound,
                            messengerChannel = client?.messengerChannel,
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

    fun confirm(sessionId: String) {
        viewModelScope.launch {
            _uiState.update { it.copy(isActionLoading = true, actionError = null) }
            try {
                val r = api.updateSession(sessionId, UpdateSessionRequest(status = SessionStatus.CONFIRMED))
                if (r.isSuccessful) {
                    _uiState.update { it.copy(isActionLoading = false, session = r.body()) }
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
                val r = api.updateSession(sessionId, UpdateSessionRequest(status = SessionStatus.COMPLETED))
                if (r.isSuccessful) {
                    _uiState.update {
                        it.copy(
                            isActionLoading = false,
                            session = r.body(),
                            reminders = emptyList(),
                        )
                    }
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
                val r = api.cancelSession(sessionId)
                if (r.isSuccessful) {
                    _uiState.update { it.copy(isActionLoading = false, cancelled = true, reminders = emptyList()) }
                } else {
                    _uiState.update { it.copy(isActionLoading = false, actionError = "Ошибка отмены") }
                }
            } catch (e: Exception) {
                _uiState.update { it.copy(isActionLoading = false, actionError = e.localizedMessage) }
            }
        }
    }

    fun resendReminder(sessionId: String, reminderId: String) {
        val session = _uiState.value.session ?: return
        val reminder = _uiState.value.reminders.firstOrNull { it.id == reminderId } ?: return
        viewModelScope.launch {
            _uiState.update { it.copy(isActionLoading = true, actionError = null) }
            try {
                val response = api.sendMessage(
                    id = session.clientId,
                    body = SendMessageRequest(
                        type = "reminder",
                        text = reminder.text,
                        sessionId = sessionId,
                    ),
                )
                if (response.isSuccessful) {
                    _uiState.update { state ->
                        state.copy(
                            isActionLoading = false,
                            reminders = state.reminders.map {
                                if (it.id == reminderId) it.copy(status = ReminderStatus.SENT) else it
                            },
                        )
                    }
                } else {
                    _uiState.update { it.copy(isActionLoading = false, actionError = "Не удалось отправить напоминание") }
                }
            } catch (e: Exception) {
                _uiState.update { it.copy(isActionLoading = false, actionError = e.localizedMessage) }
            }
        }
    }

    fun loadFreeTimes(date: String) {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoadingFreeTimes = true, freeTimesError = null) }
            try {
                val sessionId = _uiState.value.session?.id
                val r = api.getFreeTimes(date = date, sessionId = sessionId)
                if (r.isSuccessful) {
                    _uiState.update { it.copy(isLoadingFreeTimes = false, freeTimes = r.body()?.times ?: emptyList()) }
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
                    val updatedSession = r.body()
                    _uiState.update { state ->
                        val refreshedReminders = updatedSession?.let {
                            buildReminders(it, state.hasMessenger).map { reminder ->
                                reminder.copy(channel = state.messengerChannel ?: "telegram")
                            }
                        } ?: emptyList()
                        state.copy(
                            isActionLoading = false,
                            session = updatedSession,
                            reminders = refreshedReminders,
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

    fun openRescheduleDialog() = _uiState.update { it.copy(showRescheduleDialog = true, freeTimes = emptyList()) }
    fun closeRescheduleDialog() = _uiState.update { it.copy(showRescheduleDialog = false) }
    fun clearActionError() = _uiState.update { it.copy(actionError = null) }
    fun updateStatus(sessionId: String, status: String) {
        when (status.uppercase()) {
            "CONFIRMED" -> confirm(sessionId)
            "COMPLETED" -> complete(sessionId)
            "CANCELLED" -> cancel(sessionId)
            else -> {}
        }
    }
}

data class SessionDetailUiState(
    val isLoading: Boolean = false,
    val session: Session? = null,
    val error: String? = null,
    val isActionLoading: Boolean = false,
    val actionError: String? = null,
    val cancelled: Boolean = false,
    val showRescheduleDialog: Boolean = false,
    val isLoadingFreeTimes: Boolean = false,
    val freeTimes: List<String> = emptyList(),
    val freeTimesError: String? = null,
    val reminders: List<SessionReminder> = emptyList(),
    val hasMessenger: Boolean = false,
    val messengerChannel: String? = null,
)
