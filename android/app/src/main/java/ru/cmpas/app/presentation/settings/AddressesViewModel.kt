package ru.cmpas.app.presentation.settings

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import retrofit2.Response
import ru.cmpas.app.data.api.CompasApi
import ru.cmpas.app.domain.model.CreatePracticeAddressRequest
import ru.cmpas.app.domain.model.PracticeAddress
import ru.cmpas.app.domain.model.PracticeAddressList
import ru.cmpas.app.domain.model.UpdatePracticeAddressRequest
import javax.inject.Inject

// Кабинеты практики (Задача 21).
//
// Правило одно и оно определяет всё остальное: список кабинетов меняется
// ТОЛЬКО из успешного ответа сервера. Отказ ничего не убирает и ничего не
// добавляет — иначе после 409 ADDRESS_IN_USE карточка исчезла бы с экрана,
// а кабинет остался бы в работе: приложение показывало бы одно, а сервер
// знал бы другое.

/** Состояние экрана кабинетов. */
data class AddressesUiState(
    val addresses: List<PracticeAddress> = emptyList(),
    val isLoading: Boolean = true,
    /** Список не загрузился вовсе. */
    val loadError: String? = null,
    /** Действие не прошло. Список при этом остаётся прежним. */
    val actionError: String? = null,
    val isSaving: Boolean = false,
    /** Кабинет, над которым идёт действие: карточка на это время блокируется. */
    val busyAddressId: String? = null,
)

/**
 * Почему действие не прошло — словами, которые называют следующий шаг.
 *
 * 409 — не сбой связи и не ошибка приложения: сервер отказался выводить
 * кабинет, потому что на него ещё ссылаются будущие записи или расписание.
 * Разбирать это должен человек, поэтому текст говорит, что именно проверить.
 */
internal fun addressActionErrorMessage(code: Int): String = when (code) {
    409 -> "Этот кабинет используется в будущих записях или расписании. Сначала измените их, затем попробуйте снова."
    400 -> "Проверьте название и адрес — оба поля обязательны."
    401 -> "Нужно войти заново."
    404 -> "Кабинет не найден. Обновите список."
    else -> "Не удалось выполнить действие. Попробуйте ещё раз."
}

/**
 * Список из ответа. Неуспешный ответ или ответ без тела оставляет прежний:
 * «не смогли узнать» — это не «кабинетов нет».
 */
internal fun mergeAddresses(
    response: Response<PracticeAddressList>?,
    previous: List<PracticeAddress>,
): List<PracticeAddress> {
    val body = response?.takeIf { it.isSuccessful }?.body() ?: return previous
    return body.addresses
}

@HiltViewModel
class AddressesViewModel @Inject constructor(
    private val api: CompasApi,
) : ViewModel() {

    private val _uiState = MutableStateFlow(AddressesUiState())
    val uiState = _uiState.asStateFlow()

    init { refresh() }

    fun refresh() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, loadError = null) }
            val response = runCatching { api.getAddresses() }.getOrNull()
            val body = response?.takeIf { it.isSuccessful }?.body()
            _uiState.update {
                if (body == null) {
                    it.copy(isLoading = false, loadError = "Не удалось загрузить кабинеты")
                } else {
                    it.copy(addresses = body.addresses, isLoading = false, loadError = null)
                }
            }
        }
    }

    fun create(name: String, address: String) {
        val trimmedName = name.trim()
        val trimmedAddress = address.trim()
        if (trimmedName.isEmpty() || trimmedAddress.isEmpty()) {
            _uiState.update { it.copy(actionError = "Проверьте название и адрес — оба поля обязательны.") }
            return
        }

        viewModelScope.launch {
            _uiState.update { it.copy(isSaving = true, actionError = null) }
            val response = runCatching {
                api.createAddress(CreatePracticeAddressRequest(trimmedName, trimmedAddress))
            }.getOrNull()

            if (response?.isSuccessful == true) {
                // Создание отдаёт один кабинет, а метка «основной» — свойство
                // набора: перечитываем список целиком, а не дописываем строку.
                _uiState.update { it.copy(isSaving = false) }
                refresh()
            } else {
                _uiState.update {
                    it.copy(isSaving = false, actionError = addressActionErrorMessage(response?.code() ?: 0))
                }
            }
        }
    }

    fun rename(id: String, name: String, address: String) {
        val trimmedName = name.trim()
        val trimmedAddress = address.trim()
        if (trimmedName.isEmpty() || trimmedAddress.isEmpty()) {
            _uiState.update { it.copy(actionError = "Проверьте название и адрес — оба поля обязательны.") }
            return
        }
        runAction(id) { api.updateAddress(id, UpdatePracticeAddressRequest(name = trimmedName, address = trimmedAddress)) }
    }

    fun makePrimary(id: String) {
        runAction(id) { api.updateAddress(id, UpdatePracticeAddressRequest(isPrimary = true)) }
    }

    /**
     * «Убрать из работы». Не удаление: строка кабинета на сервере остаётся, у
     * прошедших сессий место встречи сохраняется. Пока кабинет занят, сервер
     * отвечает 409 — и тогда карточка остаётся на экране, потому что кабинет
     * остался в работе.
     */
    fun deactivate(id: String) {
        runAction(id) { api.deactivateAddress(id) }
    }

    fun dismissActionError() {
        _uiState.update { it.copy(actionError = null) }
    }

    private fun runAction(id: String, call: suspend () -> Response<PracticeAddressList>) {
        viewModelScope.launch {
            _uiState.update { it.copy(isSaving = true, busyAddressId = id, actionError = null) }
            val response = runCatching { call() }.getOrNull()

            _uiState.update {
                if (response?.isSuccessful == true) {
                    it.copy(
                        addresses = mergeAddresses(response, it.addresses),
                        isSaving = false,
                        busyAddressId = null,
                        actionError = null,
                    )
                } else {
                    // Список не трогаем: сервер ничего не менял.
                    it.copy(
                        isSaving = false,
                        busyAddressId = null,
                        actionError = addressActionErrorMessage(response?.code() ?: 0),
                    )
                }
            }
        }
    }
}
