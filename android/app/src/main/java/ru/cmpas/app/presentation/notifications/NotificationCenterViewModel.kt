package ru.cmpas.app.presentation.notifications

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import ru.cmpas.app.data.api.CompasApi
import ru.cmpas.app.data.api.MarkNotificationsReadRequest
import ru.cmpas.app.domain.model.PracticeNotification
import javax.inject.Inject

@HiltViewModel
class NotificationCenterViewModel @Inject constructor(
    private val api: CompasApi,
) : ViewModel() {
    private val _uiState = MutableStateFlow(NotificationCenterUiState())
    val uiState = _uiState.asStateFlow()

    fun load() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, error = null) }
            try {
                val response = api.getNotifications(limit = 20)
                if (response.isSuccessful) {
                    val body = response.body()
                    _uiState.update {
                        it.copy(
                            isLoading = false,
                            items = body?.items.orEmpty(),
                            nextCursor = body?.nextCursor,
                        )
                    }
                } else {
                    _uiState.update { it.copy(isLoading = false, error = "Не удалось загрузить уведомления") }
                }
            } catch (e: Exception) {
                _uiState.update { it.copy(isLoading = false, error = e.localizedMessage ?: "Не удалось загрузить уведомления") }
            }
        }
    }

    fun loadMore() {
        val cursor = _uiState.value.nextCursor ?: return
        if (_uiState.value.isLoadingMore) return
        viewModelScope.launch {
            _uiState.update { it.copy(isLoadingMore = true) }
            try {
                val response = api.getNotifications(cursor = cursor, limit = 20)
                if (response.isSuccessful) {
                    val body = response.body()
                    _uiState.update {
                        it.copy(
                            isLoadingMore = false,
                            items = it.items + body?.items.orEmpty(),
                            nextCursor = body?.nextCursor,
                        )
                    }
                } else {
                    _uiState.update { it.copy(isLoadingMore = false) }
                }
            } catch (_: Exception) {
                _uiState.update { it.copy(isLoadingMore = false) }
            }
        }
    }

    fun markAllVisibleRead() {
        val unreadIds = _uiState.value.items.filter { it.unread }.map { it.id }
        if (unreadIds.isEmpty()) return
        _uiState.update { state -> state.copy(items = state.items.map { item -> if (item.id in unreadIds) item.copy(unread = false) else item }) }
        viewModelScope.launch {
            runCatching { api.markNotificationsRead(MarkNotificationsReadRequest(unreadIds)) }
        }
    }

    /** Called when the sheet closes, so the psychologist gets to see what was
     * unread while it was open — the badge only clears once they leave. */
    fun markVisibleRead() = markAllVisibleRead()
}

data class NotificationCenterUiState(
    val isLoading: Boolean = false,
    val isLoadingMore: Boolean = false,
    val items: List<PracticeNotification> = emptyList(),
    val nextCursor: String? = null,
    val error: String? = null,
)
