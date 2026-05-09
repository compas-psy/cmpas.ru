package ru.cmpas.app.presentation.calendar

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import ru.cmpas.app.data.api.CompasApi
import ru.cmpas.app.data.local.LocalPracticeStore
import ru.cmpas.app.data.local.LocalScheduleBlockStore
import ru.cmpas.app.domain.model.Session
import java.time.LocalDate
import javax.inject.Inject

enum class CalendarViewMode { DAY, WEEK, MONTH, LIST }

@HiltViewModel
class CalendarViewModel @Inject constructor(
    private val api: CompasApi,
    private val localStore: LocalPracticeStore,
    private val blockStore: LocalScheduleBlockStore,
) : ViewModel() {

    private val _uiState = MutableStateFlow(CalendarUiState())
    val uiState = _uiState.asStateFlow()

    init { loadSessions() }

    fun selectDate(date: LocalDate) {
        _uiState.update { it.copy(selectedDate = date) }
        loadSessions()
    }

    fun setViewMode(mode: CalendarViewMode) {
        _uiState.update { it.copy(viewMode = mode) }
        loadSessions()
    }

    fun loadSessions() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true) }
            val range = currentRange(_uiState.value)
            val localSessions = localStore.getSessions(from = range.first, to = range.second)
            val localBlocks = blockStore.getBlocks(from = range.first, to = range.second)
            try {
                val response = api.getSessions(from = range.first, to = range.second)
                val remoteSessions = if (response.isSuccessful) response.body().orEmpty() else emptyList()
                remoteSessions.forEach { localStore.upsertSession(it) }
                _uiState.update {
                    it.copy(
                        isLoading = false,
                        sessions = mergeSessions(remoteSessions, localStore.getSessions(range.first, range.second), localBlocks),
                    )
                }
            } catch (_: Exception) {
                _uiState.update {
                    it.copy(
                        isLoading = false,
                        sessions = mergeSessions(emptyList(), localSessions, localBlocks),
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
}

data class CalendarUiState(
    val isLoading: Boolean = false,
    val selectedDate: LocalDate = LocalDate.now(),
    val viewMode: CalendarViewMode = CalendarViewMode.DAY,
    val sessions: List<Session> = emptyList(),
)
