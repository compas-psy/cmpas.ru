package ru.cmpas.app.presentation.session

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import ru.cmpas.app.data.analytics.AnalyticsRecorder
import ru.cmpas.app.data.analytics.SessionStatusTarget
import ru.cmpas.app.data.api.CompasApi
import ru.cmpas.app.data.api.ResendReminderRequest
import ru.cmpas.app.data.api.SendMessageRequest
import ru.cmpas.app.data.api.UpdateSessionRequest
import ru.cmpas.app.domain.model.ClientDetail
import ru.cmpas.app.domain.model.PaymentStatus
import ru.cmpas.app.domain.model.ReminderStatus
import ru.cmpas.app.domain.model.Session
import ru.cmpas.app.domain.model.SessionReminder
import ru.cmpas.app.domain.model.SessionStatus
import ru.cmpas.app.presentation.util.PracticeRefreshBus
import javax.inject.Inject

@HiltViewModel
class SessionDetailViewModel @Inject constructor(
    private val api: CompasApi,
    private val analytics: AnalyticsRecorder,
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
                    // Расчётные статусы из buildReminders — предположение по
                    // часам. Если сервер знает фактический исход, он заменит их.
                    if (session != null) loadServerReminders(session.id)
                } else {
                    _uiState.update { it.copy(isLoading = false, error = "Сессия не найдена") }
                }
            } catch (e: Exception) {
                _uiState.update { it.copy(isLoading = false, error = e.localizedMessage) }
            }
        }
    }

    /**
     * Ручное сообщение клиенту.
     *
     * Раньше вызов был обёрнут в runCatching, результат отбрасывался, и наружу
     * не сообщалось ничего: отправленное и не отправленное выглядели для
     * специалиста одинаково — окно просто закрывалось. Теперь исход называется.
     */
    fun sendMessage(clientId: String, sessionId: String, text: String, onFinished: (Boolean, String) -> Unit = { _, _ -> }) {
        viewModelScope.launch {
            try {
                val response = api.sendMessage(clientId, SendMessageRequest(type = "custom", text = text, sessionId = sessionId))
                if (response.isSuccessful) {
                    onFinished(true, "Сообщение отправлено")
                } else {
                    onFinished(false, "Не удалось отправить сообщение")
                }
            } catch (e: Exception) {
                onFinished(false, e.localizedMessage ?: "Не удалось отправить сообщение")
            }
        }
    }

    fun setPaymentStatus(sessionId: String, status: PaymentStatus) {
        viewModelScope.launch {
            _uiState.update { it.copy(isActionLoading = true, actionError = null) }
            try {
                val response = api.updateSession(sessionId, UpdateSessionRequest(paymentStatus = status))
                if (response.isSuccessful) {
                    _uiState.update { it.copy(isActionLoading = false, session = response.body()) }
                    PracticeRefreshBus.notifyChanged()
                } else {
                    _uiState.update { it.copy(isActionLoading = false, actionError = "Не удалось обновить оплату") }
                }
            } catch (e: Exception) {
                _uiState.update { it.copy(isActionLoading = false, actionError = e.localizedMessage) }
            }
        }
    }

    /**
     * Повторная отправка напоминания — настоящая, через сервер.
     *
     * Прежняя версия просто переводила напоминание в SENT в состоянии экрана
     * и ничего не отправляла (TODO API). Её никто не вызывал, поэтому вреда
     * она не нанесла, но такая заготовка — заряженная ловушка: первый же, кто
     * подключит к ней кнопку, получит рапорт об отправке без отправки.
     *
     * Исход берётся из ответа сервера: он же пишет попытку в ReminderOutbox,
     * тем же путём, что и рассылка по расписанию.
     */
    fun resendReminder(sessionId: String, reminderId: String, onFinished: (Boolean, String) -> Unit) {
        val kind = when {
            reminderId.endsWith(":24h") -> "session_24h_client"
            reminderId.endsWith(":1h") -> "session_1h_client"
            else -> null
        }
        if (kind == null) {
            onFinished(false, "Неизвестный тип напоминания")
            return
        }
        viewModelScope.launch {
            _uiState.update { it.copy(resendingReminderId = reminderId) }
            try {
                val response = api.resendSessionReminder(sessionId, ResendReminderRequest(kind))
                val body = response.body()
                if (response.isSuccessful && body?.sent == true) {
                    loadServerReminders(sessionId)
                    onFinished(true, "Напоминание отправлено")
                } else {
                    onFinished(false, body?.message ?: "Не удалось отправить напоминание")
                }
            } catch (e: Exception) {
                onFinished(false, e.localizedMessage ?: "Не удалось отправить напоминание")
            } finally {
                _uiState.update { it.copy(resendingReminderId = null) }
            }
        }
    }

    /**
     * Настоящий статус напоминаний — из ReminderOutbox, а не из часов.
     *
     * buildReminders() помечает напоминание как SENT, едва проходит его момент.
     * Это догадка: сервер мог не отправить сообщение вовсе. Когда сервер знает
     * исход, он его и показывает; пока строки в журнале нет — остаётся расчёт
     * по расписанию, но уже не выдаётся за подтверждённую отправку.
     */
    private fun loadServerReminders(sessionId: String) {
        viewModelScope.launch {
            val rows = try {
                val response = api.getSessionReminders(sessionId)
                if (response.isSuccessful) response.body()?.reminders.orEmpty() else emptyList()
            } catch (_: Exception) {
                emptyList()
            }
            if (rows.isEmpty()) return@launch
            _uiState.update { state ->
                state.copy(
                    reminders = state.reminders.map { reminder ->
                        val kind = if (reminder.id.endsWith(":24h")) "session_24h_client" else "session_1h_client"
                        val known = rows.filter { it.kind == kind }
                        when {
                            known.isEmpty() -> reminder
                            known.any { it.status == "sent" } -> reminder.copy(status = ReminderStatus.SENT)
                            else -> reminder.copy(status = ReminderStatus.FAILED)
                        }
                    },
                )
            }
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
                    runCatching { analytics.recordSessionStatusChanged(SessionStatusTarget.CONFIRMED, true) }
                } else {
                    _uiState.update { it.copy(isActionLoading = false, actionError = "Ошибка подтверждения") }
                    runCatching { analytics.recordSessionStatusChanged(SessionStatusTarget.CONFIRMED, false) }
                }
            } catch (e: Exception) {
                _uiState.update { it.copy(isActionLoading = false, actionError = e.localizedMessage) }
                runCatching { analytics.recordSessionStatusChanged(SessionStatusTarget.CONFIRMED, false) }
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
                    runCatching { analytics.recordSessionStatusChanged(SessionStatusTarget.COMPLETED, true) }
                } else {
                    _uiState.update { it.copy(isActionLoading = false, actionError = "Ошибка") }
                    runCatching { analytics.recordSessionStatusChanged(SessionStatusTarget.COMPLETED, false) }
                }
            } catch (e: Exception) {
                _uiState.update { it.copy(isActionLoading = false, actionError = e.localizedMessage) }
                runCatching { analytics.recordSessionStatusChanged(SessionStatusTarget.COMPLETED, false) }
            }
        }
    }

    /**
     * Специалист называет реальный исход: клиент не пришёл.
     *
     * Раньше этот метод не вызывался НИОТКУДА — UpdateSessionRequest умел
     * послать NO_SHOW, а экран умел только показать его пассивным чипом.
     * Перезаписывает статус безусловно, в том числе автоматически
     * проставленный сервером COMPLETED (settlePastSessionsForPsychologist) —
     * специалист просто уточняет исход задним числом, риска "испортить"
     * корректный статус нет.
     *
     * Аналитика session_status_changed НЕ пишется здесь: реестр допустимых
     * значений `to` — CONFIRMED/COMPLETED/CANCELLED/RESCHEDULED, ровно
     * зеркало analytics/schema/events.yaml (`to: [confirmed, completed,
     * cancelled, rescheduled]`, вне android/, править не в этой задаче).
     * NO_SHOW там не объявлен, а AnalyticsRecorder намеренно не даёт месту
     * вызова придумывать значения сверх реестра — сервер такое событие всё
     * равно бы отбросил при валидации (см. src/lib/analytics/schema.ts).
     */
    fun noShow(sessionId: String) {
        viewModelScope.launch {
            _uiState.update { it.copy(isActionLoading = true, actionError = null) }
            try {
                val response = api.updateSession(sessionId, UpdateSessionRequest(status = SessionStatus.NO_SHOW))
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
                    runCatching { analytics.recordSessionStatusChanged(SessionStatusTarget.CANCELLED, true) }
                } else {
                    _uiState.update { it.copy(isActionLoading = false, actionError = "Ошибка отмены") }
                    runCatching { analytics.recordSessionStatusChanged(SessionStatusTarget.CANCELLED, false) }
                }
            } catch (e: Exception) {
                _uiState.update { it.copy(isActionLoading = false, actionError = e.localizedMessage) }
                runCatching { analytics.recordSessionStatusChanged(SessionStatusTarget.CANCELLED, false) }
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
                    _uiState.update { it.copy(isActionLoading = false, session = r.body(), showRescheduleDialog = false) }
                    runCatching { analytics.recordSessionStatusChanged(SessionStatusTarget.RESCHEDULED, true) }
                } else {
                    _uiState.update { it.copy(isActionLoading = false, actionError = "Время уже занято") }
                    runCatching { analytics.recordSessionStatusChanged(SessionStatusTarget.RESCHEDULED, false) }
                }
            } catch (e: Exception) {
                _uiState.update { it.copy(isActionLoading = false, actionError = e.localizedMessage) }
                runCatching { analytics.recordSessionStatusChanged(SessionStatusTarget.RESCHEDULED, false) }
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
            "NO_SHOW" -> noShow(sessionId)
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
    /** id напоминания, которое сейчас отправляется повторно. */
    val resendingReminderId: String? = null,
)