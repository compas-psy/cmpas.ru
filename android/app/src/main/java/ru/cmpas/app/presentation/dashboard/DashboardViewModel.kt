package ru.cmpas.app.presentation.dashboard

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import ru.cmpas.app.data.api.CompasApi
import ru.cmpas.app.domain.model.AttentionItem
import ru.cmpas.app.domain.model.Session
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.util.Locale
import javax.inject.Inject

@HiltViewModel
class DashboardViewModel @Inject constructor(
    private val api: CompasApi,
) : ViewModel() {

    private val _uiState = MutableStateFlow(DashboardUiState())
    val uiState = _uiState.asStateFlow()

    init {
        loadDashboard()
        loadProfile()
    }

    fun loadDashboard() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, error = null) }
            try {
                val response = api.getDashboard()
                if (response.isSuccessful) {
                    response.body()?.let { data ->
                        _uiState.update {
                            it.copy(
                                isLoading = false,
                                todaySessions = data.todaySessions,
                                nextSession = data.nextSession,
                                weekSessionsCount = data.weekStats.sessionsCount,
                                newClientsCount = data.weekStats.newClients,
                                attentionItems = data.attentionItems,
                                userName = data.userName ?: it.userName,
                                bookingLink = data.bookingLink,
                                isDataLoaded = true,
                            )
                        }
                    }
                } else {
                    _uiState.update {
                        it.copy(
                            isLoading = false,
                            error = "Ошибка ${response.code()}: ${response.message()}",
                        )
                    }
                }
            } catch (e: Exception) {
                _uiState.update {
                    it.copy(
                        isLoading = false,
                        error = e.localizedMessage ?: "Ошибка подключения",
                    )
                }
            }
        }
    }

    private fun loadProfile() {
        viewModelScope.launch {
            try {
                val response = api.getProfile()
                if (response.isSuccessful) {
                    val user = response.body()
                    _uiState.update { it.copy(userName = user?.name) }
                }
            } catch (_: Exception) {}
        }
    }
}

data class DashboardUiState(
    val isLoading: Boolean = false,
    val todaySessions: List<Session> = emptyList(),
    val nextSession: Session? = null,
    val weekSessionsCount: Int = 0,
    val newClientsCount: Int = 0,
    val userName: String? = null,
    val attentionItems: List<AttentionItem> = emptyList(),
    val bookingLink: String? = null,
    val error: String? = null,
    val isDataLoaded: Boolean = false,
    val todayFormatted: String = LocalDate.now()
        .format(DateTimeFormatter.ofPattern("EEEE, d MMMM", Locale("ru")))
        .replaceFirstChar { it.uppercase() },
)
