package ru.cmpas.app.presentation.schedule

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import ru.cmpas.app.data.api.CompasApi
import ru.cmpas.app.data.api.CreateBlockRequest
import ru.cmpas.app.domain.model.TimeBlock
import ru.cmpas.app.presentation.util.PracticeRefreshBus
import java.time.LocalDate
import javax.inject.Inject

@HiltViewModel
class ScheduleViewModel @Inject constructor(
    private val api: CompasApi,
) : ViewModel() {
    private val _uiState = MutableStateFlow(ScheduleUiState())
    val uiState = _uiState.asStateFlow()

    init { loadBlocks() }

    fun loadBlocks() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, error = null) }
            try {
                val from = LocalDate.now().toString()
                val to = LocalDate.now().plusDays(120).toString()
                val response = api.getBlocks(from, to)
                if (response.isSuccessful) {
                    _uiState.update { it.copy(isLoading = false, blocks = response.body().orEmpty().sortedBy { b -> b.date }) }
                } else {
                    _uiState.update { it.copy(isLoading = false, error = "Не удалось загрузить блокировки") }
                }
            } catch (e: Exception) {
                _uiState.update { it.copy(isLoading = false, error = e.localizedMessage ?: "Не удалось загрузить блокировки") }
            }
        }
    }

    fun createBlock(
        startDate: String,
        endDate: String,
        type: String,
        reason: String?,
        cancelIntersectingSessions: Boolean,
        onFinished: (Boolean, String) -> Unit,
    ) {
        viewModelScope.launch {
            _uiState.update { it.copy(isSaving = true) }
            try {
                val response = api.createBlock(
                    CreateBlockRequest(
                        startDate = startDate,
                        endDate = endDate,
                        type = type,
                        reason = reason?.ifBlank { null },
                        cancelIntersectingSessions = cancelIntersectingSessions,
                    ),
                )
                _uiState.update { it.copy(isSaving = false) }
                if (response.isSuccessful) {
                    PracticeRefreshBus.notifyChanged()
                    loadBlocks()
                    onFinished(true, "Блокировка добавлена в расписание")
                } else {
                    onFinished(false, "Не удалось сохранить (${response.code()})")
                }
            } catch (e: Exception) {
                _uiState.update { it.copy(isSaving = false) }
                onFinished(false, e.localizedMessage ?: "Не удалось сохранить")
            }
        }
    }

    fun deleteBlock(id: String, onFinished: (Boolean, String) -> Unit) {
        viewModelScope.launch {
            _uiState.update { it.copy(deletingId = id) }
            try {
                val response = api.deleteBlock(id)
                _uiState.update { it.copy(deletingId = null) }
                if (response.isSuccessful) {
                    PracticeRefreshBus.notifyChanged()
                    loadBlocks()
                    onFinished(true, "Блокировка снята")
                } else {
                    onFinished(false, "Не удалось снять блокировку")
                }
            } catch (e: Exception) {
                _uiState.update { it.copy(deletingId = null) }
                onFinished(false, e.localizedMessage ?: "Не удалось снять блокировку")
            }
        }
    }
}

data class ScheduleUiState(
    val isLoading: Boolean = false,
    val isSaving: Boolean = false,
    val blocks: List<TimeBlock> = emptyList(),
    val deletingId: String? = null,
    val error: String? = null,
)
