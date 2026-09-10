package ru.cmpas.app.presentation.rebook

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import ru.cmpas.app.data.api.CompasApi
import ru.cmpas.app.data.api.RepeatSlotRequest
import ru.cmpas.app.domain.model.Session
import ru.cmpas.app.presentation.util.PracticeRefreshBus
import ru.cmpas.app.presentation.util.repeatReferenceSession
import javax.inject.Inject

data class RebookUiState(
    val isLoading: Boolean = true,
    val clientName: String = "",
    /** Встреча, из которой берётся «тот же час». Без неё повторять нечего. */
    val reference: Session? = null,
    val busyWeeks: Int? = null,
    val bookedDates: List<String> = emptyList(),
    val skipped: List<Pair<String, String>> = emptyList(),
    val error: String? = null,
)

/**
 * «Записать снова» — развилка после состоявшейся встречи.
 *
 * Раньше эта кнопка вела на общий экран выбора даты: календарь с нуля, будто
 * про клиента ничего не известно. Учредитель: «Где по прошедшей сессии
 * возможность запланировать регулярную (на определённый срок) или
 * забронировать слот через неделю или просто забронировать слот — все 3
 * уместны».
 *
 * Ядро для двух первых уже было написано и работало — но вызывалось только из
 * карточки клиента, куда после встречи никто не заходит. Здесь оно просто
 * оказывается там, где о следующей записи и думают.
 */
@HiltViewModel
class RebookViewModel @Inject constructor(
    private val api: CompasApi,
) : ViewModel() {
    private val _uiState = MutableStateFlow(RebookUiState())
    val uiState = _uiState.asStateFlow()

    fun load(clientId: String) {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, error = null) }
            try {
                val response = api.getClient(clientId)
                val detail = response.body()
                if (!response.isSuccessful || detail == null) {
                    _uiState.update { it.copy(isLoading = false, error = "Не удалось открыть клиента") }
                    return@launch
                }
                _uiState.update {
                    it.copy(
                        isLoading = false,
                        clientName = detail.name,
                        reference = repeatReferenceSession(detail.recentSessions),
                    )
                }
            } catch (error: Exception) {
                _uiState.update { it.copy(isLoading = false, error = error.localizedMessage ?: "Не удалось открыть клиента") }
            }
        }
    }

    /**
     * Занять тот же час на указанное число недель.
     *
     * Час выбирает сервер по той же опорной встрече, и он же проверяет
     * занятость: «занять на квартал» не должно ставить встречу поверх чужой.
     * Поэтому ответ — поимённый отчёт, а не «готово»: занятая третья неделя не
     * отменяет первых двух, и специалист должен видеть, какая дата выпала.
     */
    fun repeat(clientId: String, weeks: Int) {
        viewModelScope.launch {
            _uiState.update { it.copy(busyWeeks = weeks, error = null, bookedDates = emptyList(), skipped = emptyList()) }
            try {
                val response = api.repeatClientSlot(clientId, RepeatSlotRequest(weeks))
                val body = response.body()
                if (!response.isSuccessful || body == null) {
                    _uiState.update { it.copy(error = "Не удалось занять время") }
                    return@launch
                }
                _uiState.update {
                    it.copy(
                        bookedDates = body.booked.map { item -> item.date },
                        skipped = body.skipped.map { item -> item.date to item.reason },
                    )
                }
                if (body.booked.isNotEmpty()) PracticeRefreshBus.notifyChanged()
            } catch (error: Exception) {
                _uiState.update { it.copy(error = error.localizedMessage ?: "Не удалось занять время") }
            } finally {
                _uiState.update { it.copy(busyWeeks = null) }
            }
        }
    }

    fun clearResult() = _uiState.update { it.copy(bookedDates = emptyList(), skipped = emptyList(), error = null) }
}
