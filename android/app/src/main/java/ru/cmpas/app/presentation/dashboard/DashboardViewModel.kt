package ru.cmpas.app.presentation.dashboard

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import ru.cmpas.app.data.api.CompasApi
import ru.cmpas.app.data.api.UpdateSessionRequest
import ru.cmpas.app.data.sync.OutboxSync
import ru.cmpas.app.domain.model.AttentionItem
import ru.cmpas.app.domain.model.PaymentStatus
import ru.cmpas.app.domain.model.PracticeNotification
import ru.cmpas.app.domain.model.Session
import ru.cmpas.app.presentation.util.PracticeRefreshBus
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.util.Locale
import javax.inject.Inject

@HiltViewModel
class DashboardViewModel @Inject constructor(
    private val api: CompasApi,
    private val outbox: OutboxSync,
) : ViewModel() {
    private val _uiState = MutableStateFlow(DashboardUiState())
    val uiState = _uiState.asStateFlow()

    init {
        loadDashboard()
        loadProfile()
        syncOutbox()
        viewModelScope.launch {
            PracticeRefreshBus.changes.collectLatest { loadDashboard(showLoader = false) }
        }
    }

    fun refresh() {
        loadDashboard(showLoader = false)
        syncOutbox()
    }

    /**
     * Досылка недоставленного и честный счётчик на экране.
     *
     * Молчаливая потеря без счётчика превращается в молчаливое ожидание:
     * специалист не узнает ни что что-то не уехало, ни что оно уехало потом.
     * Падение досылки не роняет экран — вся работа в runCatching.
     */
    private fun syncOutbox() {
        viewModelScope.launch {
            val result = runCatching { outbox.sync() }.getOrNull() ?: return@launch
            _uiState.update { it.copy(undeliveredCount = result.remaining) }
            if (result.delivered > 0) loadDashboard(showLoader = false)
        }
    }

    fun loadDashboard(showLoader: Boolean = true) {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = showLoader && !it.isDataLoaded, isRefreshing = !showLoader, error = null) }
            try {
                val response = api.getDashboard()
                if (response.isSuccessful) {
                    response.body()?.let { data ->
                        _uiState.update {
                            it.copy(
                                isLoading = false,
                                isRefreshing = false,
                                todaySessions = data.todaySessions,
                                nextSession = data.nextSession,
                                weekSessionsCount = data.weekStats.sessionsCount,
                                newClientsCount = data.weekStats.newClients,
                                attentionItems = data.attentionItems,
                                notifications = data.notifications,
                                userName = data.userName ?: it.userName,
                                bookingLink = data.bookingLink,
                                needsOnboarding = data.needsOnboarding,
                                onboardingUrl = data.onboardingUrl,
                                isDataLoaded = true,
                            )
                        }
                    } ?: _uiState.update { it.copy(isLoading = false, isRefreshing = false) }
                } else {
                    _uiState.update { it.copy(isLoading = false, isRefreshing = false, error = "Ошибка ${response.code()}: ${response.message()}") }
                }
            } catch (e: Exception) {
                _uiState.update { it.copy(isLoading = false, isRefreshing = false, error = e.localizedMessage ?: "Ошибка подключения") }
            }
        }
    }

    fun markPaid(sessionId: String) {
        viewModelScope.launch {
            _uiState.update { it.copy(paymentUpdatingSessionId = sessionId) }
            try {
                val response = api.updateSession(sessionId, UpdateSessionRequest(paymentStatus = PaymentStatus.PAID))
                if (response.isSuccessful) {
                    PracticeRefreshBus.notifyChanged()
                    loadDashboard(showLoader = false)
                } else {
                    _uiState.update { it.copy(error = "Не удалось отметить оплату") }
                }
            } catch (e: Exception) {
                _uiState.update { it.copy(error = e.localizedMessage ?: "Не удалось отметить оплату") }
            } finally {
                _uiState.update { it.copy(paymentUpdatingSessionId = null) }
            }
        }
    }

    private fun loadProfile() {
        viewModelScope.launch {
            try {
                val response = api.getProfile()
                if (response.isSuccessful) _uiState.update { it.copy(userName = response.body()?.name) }
            } catch (_: Exception) {}
        }
    }
}

data class DashboardUiState(
    val isLoading: Boolean = false,
    val isRefreshing: Boolean = false,
    val todaySessions: List<Session> = emptyList(),
    val nextSession: Session? = null,
    val weekSessionsCount: Int = 0,
    val newClientsCount: Int = 0,
    val userName: String? = null,
    val attentionItems: List<AttentionItem> = emptyList(),
    val notifications: List<PracticeNotification> = emptyList(),
    val bookingLink: String? = null,
    val needsOnboarding: Boolean = false,
    val onboardingUrl: String? = null,
    val error: String? = null,
    val isDataLoaded: Boolean = false,
    val paymentUpdatingSessionId: String? = null,
    /** Сколько записей ещё не доставлено на сервер (очередь досылки). */
    val undeliveredCount: Int = 0,
    val todayFormatted: String = LocalDate.now()
        .format(DateTimeFormatter.ofPattern("EEEE, d MMMM", Locale("ru")))
        .replaceFirstChar { it.uppercase() },
)
