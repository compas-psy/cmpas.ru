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
import ru.cmpas.app.domain.model.ReminderStatus
import ru.cmpas.app.domain.model.Session
import ru.cmpas.app.domain.model.SessionFormat
import ru.cmpas.app.domain.model.SessionReminder
import ru.cmpas.app.domain.model.SessionStatus
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.LocalTime
import java.time.format.TextStyle
import java.util.Locale
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
                    // TODO: получать привязку к боту из карточки клиента (hasMessenger).
                    // Пока считаем большинство клиентов привязанными.
                    val bound = true
                    val reminders = session?.let { buildReminders(it, bound) } ?: emptyList()
                    _uiState.update { it.copy(isLoading = false, session = session, reminders = reminders) }
                } else {
                    _uiState.update { it.copy(isLoading = false, error = "Сессия не найдена") }
                }
            } catch (e: Exception) {
                _uiState.update { it.copy(isLoading = false, error = e.localizedMessage) }
            }
        }
    }

    /** Повторная отправка напоминания. TODO: подключить к API, когда появится эндпоинт. */
    fun resendReminder(sessionId: String, reminderId: String) {
        // Заглушка: помечаем напоминание как отправленное локально.
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
                if (r.isSuccessful) _uiState.update { it.copy(isActionLoading = false, session = r.body()) }
                else _uiState.update { it.copy(isActionLoading = false, actionError = "Ошибка") }
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
                    _uiState.update { it.copy(isActionLoading = false, cancelled = true) }
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
                    _uiState.update { it.copy(isActionLoading = false, session = r.body(), showRescheduleDialog = false) }
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
)

/**
 * Генерирует ленту напоминаний для сессии (пока бэкенд их не отдаёт).
 * Две записи: «За 24 часа» (с QR оплаты) и «За 1–2 часа».
 *
 * Если клиент не привязан к боту, все статусы трактуем как SCHEDULED.
 */
fun buildReminders(session: Session, bound: Boolean): List<SessionReminder> {
    val start: LocalDateTime? = try {
        val p = session.startTime.split(":")
        LocalDateTime.of(LocalDate.parse(session.date), LocalTime.of(p[0].toInt(), p[1].toInt()))
    } catch (_: Exception) { null }

    val now = LocalDateTime.now()
    val channel = "telegram"
    val isOnline = session.format == SessionFormat.ONLINE

    fun status(at: LocalDateTime?): ReminderStatus =
        if (bound && at != null && at.isBefore(now)) ReminderStatus.SENT else ReminderStatus.SCHEDULED

    val at24 = start?.minusHours(24)
    val at2 = start?.minusHours(2)

    return listOf(
        SessionReminder(
            id = "${session.id}-24h",
            whenLabel = "За 24 часа",
            atLabel = atLabel(at24),
            channel = channel,
            status = status(at24),
            withPayment = true,
            text = "Напоминание о консультации с деталями встречи и QR-кодом для оплаты.",
        ),
        SessionReminder(
            id = "${session.id}-2h",
            whenLabel = "За 1–2 часа",
            atLabel = atLabel(at2),
            channel = channel,
            status = status(at2),
            withPayment = false,
            text = if (isOnline)
                "Короткое напоминание перед встречей со ссылкой для подключения."
            else
                "Короткое напоминание перед встречей с адресом кабинета.",
        ),
    )
}

/** "Завтра · 09:00" / "Сегодня · 18:00" / "ср · 09:00". */
private fun atLabel(at: LocalDateTime?): String {
    if (at == null) return ""
    val today = LocalDate.now()
    val day = when (at.toLocalDate()) {
        today -> "Сегодня"
        today.plusDays(1) -> "Завтра"
        today.minusDays(1) -> "Вчера"
        else -> at.dayOfWeek.getDisplayName(TextStyle.SHORT, Locale("ru"))
    }
    val time = "%02d:%02d".format(at.hour, at.minute)
    return "$day · $time"
}
