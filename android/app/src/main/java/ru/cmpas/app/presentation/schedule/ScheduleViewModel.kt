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
import ru.cmpas.app.data.api.CreateSlotRequest
import ru.cmpas.app.data.api.UpdateSlotRequest
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

    /**
     * Быстрая кнопка. `null` в часах — это «весь день».
     *
     * Именно null, а не 00:00–23:59 руками: значения по умолчанию живут в
     * общем серверном правиле (src/lib/practice/block-window.ts), и вторая
     * их копия здесь однажды разошлась бы с первой. Кнопка «С 18:00»
     * передаёт настоящие часы — ей есть что сказать.
     */
    fun quickBlock(
        startDate: String,
        endDate: String = startDate,
        startTime: String? = null,
        endTime: String? = null,
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

    // ── Рабочие часы ──────────────────────────────────────────────────────
    //
    // До этого приложение расписание только показывало, а на любую правку
    // отправляло в веб-кабинет. Практик с телефоном в руках не мог поменять
    // часы конкретного дня недели — а это и есть та правка, которая нужна
    // чаще всего и обычно срочно.
    //
    // Правила живут на сервере (пересечения, кабинет, обед) и одни на оба
    // входа. Здесь только вызов и честная передача ответа на экран.

    /**
     * Сообщение сервера для человека, а не «Ошибка (400)».
     *
     * Сервер отвечает `{"error":"Расписание пересекается с существующим:
     * Вт 10:00–18:00"}` — это единственная подсказка, из которой понятно,
     * ЧТО именно мешает сохранить. Заменить её кодом ответа значит оставить
     * человека наедине с непонятно почему не сохраняющейся формой.
     */
    private fun errorText(raw: String?, fallback: String): String {
        if (raw.isNullOrBlank()) return fallback
        val message = Regex("\"error\"\\s*:\\s*\"(.*?)\"").find(raw)?.groupValues?.getOrNull(1)
        return message?.takeIf { it.isNotBlank() } ?: fallback
    }

    fun addSlot(
        dayOfWeek: Int,
        startTime: String,
        endTime: String,
        duration: Int,
        format: String,
        addressId: String?,
        startDate: String,
        endDate: String,
        scheduleRuleId: String?,
        onFinished: (Boolean, String) -> Unit,
    ) {
        viewModelScope.launch {
            _uiState.update { it.copy(isSaving = true) }
            try {
                val response = api.createSlot(
                    CreateSlotRequest(
                        startDate = startDate,
                        endDate = endDate,
                        daysOfWeek = listOf(dayOfWeek),
                        startTime = startTime,
                        endTime = endTime,
                        duration = duration,
                        format = format,
                        addressId = addressId,
                        scheduleRuleId = scheduleRuleId,
                    ),
                )
                _uiState.update { it.copy(isSaving = false) }
                if (response.isSuccessful) {
                    PracticeRefreshBus.notifyChanged()
                    loadSchedule()
                    onFinished(true, "Часы добавлены")
                } else {
                    onFinished(false, errorText(response.errorBody()?.string(), "Не удалось добавить часы"))
                }
            } catch (e: Exception) {
                _uiState.update { it.copy(isSaving = false) }
                onFinished(false, e.localizedMessage ?: "Не удалось добавить часы")
            }
        }
    }

    fun updateSlot(
        id: String,
        startTime: String,
        endTime: String,
        duration: Int,
        format: String,
        addressId: String?,
        onFinished: (Boolean, String) -> Unit,
    ) {
        viewModelScope.launch {
            _uiState.update { it.copy(isSaving = true) }
            try {
                val response = api.updateSlot(
                    id,
                    UpdateSlotRequest(
                        startTime = startTime,
                        endTime = endTime,
                        duration = duration,
                        format = format,
                        addressId = addressId,
                    ),
                )
                _uiState.update { it.copy(isSaving = false) }
                if (response.isSuccessful) {
                    PracticeRefreshBus.notifyChanged()
                    loadSchedule()
                    onFinished(true, "Часы изменены")
                } else {
                    onFinished(false, errorText(response.errorBody()?.string(), "Не удалось изменить часы"))
                }
            } catch (e: Exception) {
                _uiState.update { it.copy(isSaving = false) }
                onFinished(false, e.localizedMessage ?: "Не удалось изменить часы")
            }
        }
    }

    fun deleteSlot(id: String, onFinished: (Boolean, String) -> Unit) {
        viewModelScope.launch {
            _uiState.update { it.copy(deletingId = id) }
            try {
                val response = api.deleteSlot(id)
                _uiState.update { it.copy(deletingId = null) }
                if (response.isSuccessful) {
                    PracticeRefreshBus.notifyChanged()
                    loadSchedule()
                    onFinished(true, "Часы убраны")
                } else {
                    onFinished(false, errorText(response.errorBody()?.string(), "Не удалось убрать часы"))
                }
            } catch (e: Exception) {
                _uiState.update { it.copy(deletingId = null) }
                onFinished(false, e.localizedMessage ?: "Не удалось убрать часы")
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
