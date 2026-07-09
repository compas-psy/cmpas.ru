package ru.cmpas.app.presentation.schedule

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import ru.cmpas.app.data.api.AvailabilityRule
import ru.cmpas.app.data.api.AvailabilitySlotDto
import ru.cmpas.app.data.api.CompasApi
import ru.cmpas.app.data.api.CreateBlockRequest
import ru.cmpas.app.data.api.ScheduleModeRequest
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

    init { loadSchedule() }

    fun loadSchedule() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, error = null) }
            try {
                val availability = api.getAvailability()
                if (availability.isSuccessful) {
                    val body = availability.body()
                    _uiState.update {
                        it.copy(
                            scheduleMode = body?.scheduleMode ?: "private",
                            bookingBufferHours = body?.bookingBufferHours ?: 24,
                            bookingHorizonDays = body?.bookingHorizonDays ?: 14,
                            cancellationHours = body?.cancellationHours ?: 24,
                            rules = body?.rules.orEmpty(),
                            slots = body?.slots.orEmpty(),
                            blocks = body?.blocks.orEmpty().sortedBy { block -> block.date },
                            isLoading = false,
                        )
                    }
                } else {
                    loadBlocksFallback("Не удалось загрузить расписание")
                }
            } catch (e: Exception) {
                loadBlocksFallback(e.localizedMessage ?: "Не удалось загрузить расписание")
            }
        }
    }

    fun loadBlocks() = loadSchedule()

    private suspend fun loadBlocksFallback(message: String) {
        try {
            val from = LocalDate.now().toString()
            val to = LocalDate.now().plusDays(120).toString()
            val response = api.getBlocks(from, to)
            if (response.isSuccessful) {
                _uiState.update { it.copy(isLoading = false, error = message, blocks = response.body().orEmpty().sortedBy { b -> b.date }) }
            } else {
                _uiState.update { it.copy(isLoading = false, error = message) }
            }
        } catch (_: Exception) {
            _uiState.update { it.copy(isLoading = false, error = message) }
        }
    }

    fun updateScheduleMode(mode: String, onFinished: (Boolean, String) -> Unit) {
        viewModelScope.launch {
            _uiState.update { it.copy(isSavingMode = true) }
            try {
                val response = api.updateScheduleMode(ScheduleModeRequest(mode))
                _uiState.update { it.copy(isSavingMode = false) }
                if (response.isSuccessful) {
                    _uiState.update { it.copy(scheduleMode = response.body()?.scheduleMode ?: mode) }
                    PracticeRefreshBus.notifyChanged()
                    onFinished(true, scheduleModeLabel(mode))
                } else {
                    onFinished(false, "Не удалось изменить режим записи")
                }
            } catch (e: Exception) {
                _uiState.update { it.copy(isSavingMode = false) }
                onFinished(false, e.localizedMessage ?: "Не удалось изменить режим записи")
            }
        }
    }

    fun quickBlock(
        startDate: String,
        endDate: String = startDate,
        startTime: String = "00:00",
        endTime: String = "23:59",
        type: String = "personal",
        reason: String,
        cancelIntersectingSessions: Boolean = false,
        onFinished: (Boolean, String) -> Unit,
    ) = createBlock(
        startDate = startDate,
        endDate = endDate,
        startTime = startTime,
        endTime = endTime,
        type = type,
        reason = reason,
        cancelIntersectingSessions = cancelIntersectingSessions,
        onFinished = onFinished,
    )

    fun createBlock(
        startDate: String,
        endDate: String,
        type: String,
        reason: String?,
        cancelIntersectingSessions: Boolean,
        onFinished: (Boolean, String) -> Unit,
    ) = createBlock(
        startDate = startDate,
        endDate = endDate,
        startTime = null,
        endTime = null,
        type = type,
        reason = reason,
        cancelIntersectingSessions = cancelIntersectingSessions,
        onFinished = onFinished,
    )

    fun createBlock(
        startDate: String,
        endDate: String,
        startTime: String?,
        endTime: String?,
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
                        startTime = startTime,
                        endTime = endTime,
                        type = type,
                        reason = reason?.ifBlank { null },
                        cancelIntersectingSessions = cancelIntersectingSessions,
                    ),
                )
                _uiState.update { it.copy(isSaving = false) }
                if (response.isSuccessful) {
                    PracticeRefreshBus.notifyChanged()
                    loadSchedule()
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
                    loadSchedule()
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
    val isSavingMode: Boolean = false,
    val scheduleMode: String = "private",
    val bookingBufferHours: Int = 24,
    val bookingHorizonDays: Int = 14,
    val cancellationHours: Int = 24,
    val rules: List<AvailabilityRule> = emptyList(),
    val slots: List<AvailabilitySlotDto> = emptyList(),
    val blocks: List<TimeBlock> = emptyList(),
    val deletingId: String? = null,
    val error: String? = null,
)

fun scheduleModeLabel(mode: String) = when (mode) {
    "booking" -> "Запись открыта"
    "readonly" -> "Превью расписания"
    else -> "Запись закрыта"
}
