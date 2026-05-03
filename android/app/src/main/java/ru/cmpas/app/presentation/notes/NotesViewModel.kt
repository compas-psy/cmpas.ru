package ru.cmpas.app.presentation.notes

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
import javax.inject.Inject

@HiltViewModel
class NotesViewModel @Inject constructor(
    private val api: CompasApi,
) : ViewModel() {

    private val _uiState = MutableStateFlow(NotesUiState())
    val uiState = _uiState.asStateFlow()

    init {
        loadRecentSessions()
    }

    private fun loadRecentSessions() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true) }
            try {
                val today = LocalDate.now()
                val from = today.minusDays(14).toString()
                val to = today.toString()
                val response = api.getSessions(from = from, to = to)
                if (response.isSuccessful) {
                    val sessions = (response.body() ?: emptyList())
                        .sortedByDescending { it.date }
                    _uiState.update {
                        it.copy(isLoading = false, recentSessions = sessions)
                    }
                } else {
                    _uiState.update { it.copy(isLoading = false) }
                }
            } catch (_: Exception) {
                _uiState.update { it.copy(isLoading = false) }
            }
        }
    }
}

data class NotesUiState(
    val isLoading: Boolean = false,
    val recentSessions: List<Session> = emptyList(),
)
