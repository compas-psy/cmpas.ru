package ru.cmpas.app.presentation.calendar

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import retrofit2.Response
import ru.cmpas.app.data.api.CompasApi
import ru.cmpas.app.data.api.CreateBlockRequest
import ru.cmpas.app.data.local.LocalPracticeStore
import ru.cmpas.app.domain.model.ConsentStatus
import ru.cmpas.app.domain.model.HomeworkStatus
import ru.cmpas.app.domain.model.PaymentStatus
import ru.cmpas.app.domain.model.Session
import ru.cmpas.app.domain.model.SessionFormat
import ru.cmpas.app.domain.model.SessionStatus
import ru.cmpas.app.domain.model.TimeBlock
import ru.cmpas.app.presentation.util.PracticeRefreshBus
import java.time.LocalDate
import javax.inject.Inject

enum class CalendarViewMode { DAY, WEEK, MONTH, LIST }

@HiltViewModel
class CalendarViewModel @Inject constructor(
    private val api: CompasApi,
    private val localStore: LocalPracticeStore,
) : ViewModel() {

    private val _uiState = MutableStateFlow(CalendarUiState())
    val uiState = _uiState.asStateFlow()

    init {
        loadSessions()
        viewModelScope.launch {
            PracticeRefreshBus.changes.collectLatest { loadSessions(showLoader = false) }
        }
    }

    fun selectDate(date: LocalDate) {
        _uiState.update { it.copy(selectedDate = date) }
        loadSessions()
    }

    fun setViewMode(mode: CalendarViewMode) {
        _uiState.update { it.copy(viewMode = mode) }
        loadSessions()
    }

    fun refresh() = loadSessions(showLoader = false)

    fun loadSessions(showLoader: Boolean = true) {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = showLoader && it.sessions.isEmpty(), isRefreshing = !showLoader) }
            val range = currentRange(_uiState.value)
            val localSessions = localStore.getSessions(from = range.first, to = range.second)
            val blocks = runCatching { api.getBlocks(range.first, range.second) }
                .getOrNull()?.takeIf { it.isSuccessful }?.body().orEmpty().map { it.toSession() }
            try {
                val response = api.getSessions(from = range.first, to = range.second)
                val remoteSessions = if (response.isSuccessful) response.body().orEmpty() else emptyList()
                remoteSessions.forEach(localStore::upsertSession)
                _uiState.update {
                    it.copy(
                        isLoading = false,
                        isRefreshing = false,
                        sessions = mergeSessions(remoteSessions, localStore.getSessions(range.first, range.second), blocks),
                    )
                }
            } catch (_: Exception) {
                _uiState.update {
                    it.copy(
                        isLoading = false,
                        isRefreshing = false,
                        sessions = mergeSessions(emptyList(), localSessions, blocks),
                    )
                }
            }
        }
    }

    fun getSessionsForDate(date: LocalDate): List<Session> {
        return _uiState.value.sessions.filter { it.date == date.toString() }
    }

    private fun currentRange(state: CalendarUiState): Pair<String, String> {
        return when (state.viewMode) {
            CalendarViewMode.DAY -> state.selectedDate.toString() to state.selectedDate.toString()
            CalendarViewMode.WEEK -> {
                val start = state.selectedDate.minusDays(state.selectedDate.dayOfWeek.value.toLong() - 1)
                start.toString() to start.plusDays(6).toString()
            }
            CalendarViewMode.MONTH -> {
                val start = state.selectedDate.withDayOfMonth(1)
                start.toString() to start.plusMonths(1).minusDays(1).toString()
            }
            CalendarViewMode.LIST -> state.selectedDate.toString() to state.selectedDate.plusDays(14).toString()
        }
    }

    private fun mergeSessions(remote: List<Session>, local: List<Session>, blocks: List<Session>): List<Session> {
        return (remote + local + blocks)
            .distinctBy { it.id }
            .sortedWith(compareBy<Session> { it.date }.thenBy { it.startTime })
    }

    private fun TimeBlock.toSession(): Session {
        val typeLabel = when (type) {
            "vacation" -> "Отпуск"
            "sick" -> "Больничный"
            "personal" -> "Личное"
            else -> "Блокировка"
        }
        return Session(
            id = "block-$id",
            clientId = "local-block",
            clientName = typeLabel,
            date = date,
            startTime = startTime,
            endTime = endTime,
            status = SessionStatus.CONFIRMED,
            format = SessionFormat.IN_PERSON,
            notes = reason,
            paymentStatus = PaymentStatus.NOT_REQUIRED,
            consentStatus = ConsentStatus.OK,
            homeworkStatus = HomeworkStatus.NOT_ASSIGNED,
        )
    }

    /**
     * Заблокировать время (Задача 22).
     *
     * Блокировка существует только тогда, когда о ней знает сервер: именно
     * серверную строку DiaryBlock читает резолвер доступности, и только она
     * убирает время из клиентской записи. Поэтому успех показывается
     * исключительно по подтверждению сервера.
     *
     * Очередь досылки (LocalPracticeStore) знает три вида записей — клиент,
     * сессия, заметка — и блокировки среди них нет. Расширять её ради
     * Задачи 22 не нужно, но и делать вид, что «сохранилось», нельзя:
     * специалист закрыл бы вечер, а клиент всё равно записался бы на него.
     * Поэтому при отказе — честная ошибка и открытая форма.
     */
    fun createBlock(date: LocalDate, startTime: String, endTime: String, reason: String?) {
        val invalid = blockTimeError(startTime, endTime)
        if (invalid != null) {
            _uiState.update { it.copy(blockError = invalid) }
            return
        }

        viewModelScope.launch {
            _uiState.update { it.copy(isSavingBlock = true, blockError = null) }
            val response = runCatching {
                api.createBlock(blockRequest(date, startTime, endTime, reason))
            }.getOrNull()

            if (response?.isSuccessful == true) {
                _uiState.update { it.copy(isSavingBlock = false, blockSaved = true, blockError = null) }
                // Календарь перечитывается с сервера: блокировка появляется в
                // дне тем же путём, каким она туда попадает при любом другом
                // заходе, а не дорисовывается локально.
                loadSessions(showLoader = false)
            } else {
                _uiState.update {
                    it.copy(isSavingBlock = false, blockError = blockSaveErrorMessage(response))
                }
            }
        }
    }

    /** Форма закрыта — признак подтверждения гасим, чтобы он не сработал дважды. */
    fun consumeBlockSaved() {
        _uiState.update { it.copy(blockSaved = false) }
    }

    fun dismissBlockError() {
        _uiState.update { it.copy(blockError = null) }
    }
}

/** «ЧЧ:ММ» в минуты от полуночи; null — это не время. */
private fun parseMinutes(value: String): Int? {
    val match = Regex("""^(\d{1,2}):(\d{2})$""").find(value.trim()) ?: return null
    val hours = match.groupValues[1].toInt()
    val minutes = match.groupValues[2].toInt()
    if (hours > 23 || minutes > 59) return null
    return hours * 60 + minutes
}

/**
 * Проверка времени до отправки. null — можно сохранять.
 *
 * Та же граница стоит и на сервере (POST /api/mobile/blocks отвечает 400):
 * проверка на клиенте нужна, чтобы человек увидел ошибку сразу, а не чтобы
 * заменить серверную.
 */
internal fun blockTimeError(startTime: String, endTime: String): String? {
    val start = parseMinutes(startTime)
    val end = parseMinutes(endTime)
    if (start == null || end == null) return "Время указывается как ЧЧ:ММ, например 14:00."
    if (end <= start) return "Конец должен быть позже начала."
    return null
}

/**
 * Тело запроса блокировки.
 *
 * cancelIntersectingSessions остаётся false: Задача 22 закрывает время для
 * НОВЫХ записей и не отменяет уже назначенные встречи. Отменить встречу
 * человека молча, одним переключателем в шторке, нельзя.
 */
internal fun blockRequest(
    date: LocalDate,
    startTime: String,
    endTime: String,
    reason: String?,
): CreateBlockRequest = CreateBlockRequest(
    startDate = date.toString(),
    endDate = date.toString(),
    startTime = startTime.trim(),
    endTime = endTime.trim(),
    type = "personal",
    reason = reason?.trim()?.takeIf { it.isNotEmpty() },
    cancelIntersectingSessions = false,
)

/** Почему не сохранилось. Отсутствие ответа — это связь, а не отказ сервера. */
internal fun blockSaveErrorMessage(response: Response<*>?): String = when (response?.code()) {
    null -> "Не удалось заблокировать время. Проверьте подключение и попробуйте снова."
    400 -> "Проверьте дату и время: конец должен быть позже начала."
    401 -> "Нужно войти заново."
    else -> "Не удалось заблокировать время. Попробуйте ещё раз."
}

data class CalendarUiState(
    val isLoading: Boolean = false,
    val isRefreshing: Boolean = false,
    val selectedDate: LocalDate = LocalDate.now(),
    val viewMode: CalendarViewMode = CalendarViewMode.DAY,
    val sessions: List<Session> = emptyList(),
    /** Идёт сохранение блокировки. */
    val isSavingBlock: Boolean = false,
    /** Почему блокировка не сохранилась. Форма при этом остаётся открытой. */
    val blockError: String? = null,
    /** Сервер подтвердил блокировку — только теперь форму можно закрывать. */
    val blockSaved: Boolean = false,
)
