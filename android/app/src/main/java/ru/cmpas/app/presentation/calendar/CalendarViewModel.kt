package ru.cmpas.app.presentation.calendar

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import ru.cmpas.app.data.api.CompasApi
import ru.cmpas.app.domain.model.Session
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import javax.inject.Inject

enum class CalendarViewMode { DAY, WEEK, MONTH, LIST }

@HiltViewModel
class CalendarViewModel @Inject constructor(
    private val api: CompasApi,
) : ViewModel() {

    private val _uiState = MutableStateFlow(CalendarUiState())
    val uiState = _uiState.asStateFlow()

    init {
        loadSessions()
    }

    fun selectDate(date: LocalDate) {
        _uiState.update { it.copy(selectedDate = date) }
        loadSessions()
    }

    fun setViewMode(mode: CalendarViewMode) {
        _uiState.update { it.copy(viewMode = mode) }
    }

    fun loadSessions() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true) }
            try {
                val state = _uiState.value
                val from: String
                val to: String
                when (state.viewMode) {
                    CalendarViewMode.DAY -> {
                        from = state.selectedDate.toString()
                        to = state.selectedDate.toString()
                    }
                    CalendarViewMode.WEEK -> {
                        val start = state.selectedDate.minusDays(state.selectedDate.dayOfWeek.value.toLong() - 1)
                        from = start.toString()
                        to = start.plusDays(6).toString()
                    }
                    CalendarViewMode.MONTH -> {
                        val start = state.selectedDate.withDayOfMonth(1)
                        from = start.toString()
                        to = start.plusMonths(1).minusDays(1).toString()
                    }
                    CalendarViewMode.LIST -> {
                        from = state.selectedDate.toString()
                        to = state.selectedDate.plusDays(14).toString()
                    }
                }
                val response = api.getSessions(from = from, to = to)
                if (response.isSuccessful) {
                    _uiState.update {
                        it.copy(
                            isLoading = false,
                            sessions = response.body() ?: emptyList(),
                        )
                    }
                } else {
                    _uiState.update { it.copy(isLoading = false) }
                }
            } catch (_: Exception) {
                _uiState.update { it.copy(isLoading = false) }
            }
        }
    }

    fun getSessionsForDate(date: LocalDate): List<Session> {
        return _uiState.value.sessions.filter { it.date == date.toString() }
    }
}

data class CalendarUiState(
    val isLoading: Boolean = false,
    val selectedDate: LocalDate = LocalDate.now(),
    val viewMode: CalendarViewMode = CalendarViewMode.DAY,
    val sessions: List<Session> = emptyList(),
)
