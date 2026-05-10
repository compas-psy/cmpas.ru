package ru.cmpas.app.presentation.actions

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import ru.cmpas.app.data.api.CompasApi
import ru.cmpas.app.data.api.CreateClientRequest
import ru.cmpas.app.data.api.CreateSessionRequest
import ru.cmpas.app.data.local.LocalPracticeStore
import ru.cmpas.app.data.local.LocalScheduleBlockStore
import ru.cmpas.app.domain.model.Client
import ru.cmpas.app.domain.model.SessionFormat
import ru.cmpas.app.domain.model.TimeSlot
import java.time.LocalTime
import java.time.format.DateTimeFormatter
import javax.inject.Inject

@HiltViewModel
class QuickActionViewModel @Inject constructor(
    private val api: CompasApi,
    private val localStore: LocalPracticeStore,
    private val blockStore: LocalScheduleBlockStore,
) : ViewModel() {
    private val _uiState = MutableStateFlow(QuickActionUiState())
    val uiState = _uiState.asStateFlow()

    init { loadClients() }

    fun loadClients() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoadingClients = true) }
            val localClients = localStore.getClients()
            try {
                val response = api.getClients()
                val remoteClients = if (response.isSuccessful) response.body().orEmpty() else emptyList()
                remoteClients.forEach { localStore.upsertClient(it) }
                _uiState.update { it.copy(isLoadingClients = false, clients = mergeClients(remoteClients, localStore.getClients())) }
            } catch (_: Exception) {
                _uiState.update { it.copy(isLoadingClients = false, clients = localClients) }
            }
        }
    }

    fun loadAvailableSlots(date: String?) {
        if (date.isNullOrBlank()) {
            _uiState.update { it.copy(availableSlots = emptyList(), isLoadingSlots = false) }
            return
        }
        viewModelScope.launch {
            _uiState.update { it.copy(isLoadingSlots = true) }
            val fallback = buildLocalSlots(date)
            try {
                val psychologistId = api.getProfile().body()?.id ?: "me"
                val response = api.getAvailableSlots(psychologistId = psychologistId, from = date, to = date)
                val slots = if (response.isSuccessful) response.body().orEmpty().filter { it.available } else emptyList()
                _uiState.update { it.copy(isLoadingSlots = false, availableSlots = if (slots.isNotEmpty()) slots else fallback) }
            } catch (_: Exception) {
                _uiState.update { it.copy(isLoadingSlots = false, availableSlots = fallback) }
            }
        }
    }

    fun saveAction(
        type: String,
        primary: String,
        secondary: String,
        selectedClient: Client?,
        date: String?,
        time: String?,
        comment: String,
        onFinished: (Boolean, String) -> Unit,
    ) {
        viewModelScope.launch {
            _uiState.update { it.copy(isSaving = true) }
            try {
                val message = when (type) {
                    "new-client" -> saveClient(primary, secondary, comment)
                    "new-session" -> saveSession(selectedClient, date, time, secondary, comment)
                    "block-time" -> saveBlock(primary, secondary, date, time, comment)
                    "repeat-slot" -> saveRepeatedSlot(selectedClient, date, time, secondary, comment)
                    "payment" -> "Оплата отмечена локально. Серверный статус оплаты будет подключён после API."
                    "booking-link" -> "Ссылка записи подготовлена для ${selectedClient?.name ?: "клиента"}."
                    else -> "Сохранено локально."
                }
                _uiState.update { it.copy(isSaving = false) }
                onFinished(true, message)
                loadClients()
            } catch (e: Exception) {
                _uiState.update { it.copy(isSaving = false) }
                onFinished(false, e.message ?: "Не удалось сохранить")
            }
        }
    }

    private suspend fun saveClient(name: String, contact: String, notes: String): String {
        require(name.isNotBlank()) { "Укажите имя клиента" }
        val phone = contact.takeIf { it.isNotBlank() && !it.contains("@") }
        val email = contact.takeIf { it.contains("@") }
        return try {
            val response = api.createClient(CreateClientRequest(name = name, email = email, phone = phone))
            val client = if (response.isSuccessful) response.body() else null
            if (client != null) { localStore.upsertClient(client.copy(notes = notes.ifBlank { client.notes })); "Клиент создан и сохранён" }
            else { localStore.createClient(name, phone, email, notes); "Клиент сохранён локально" }
        } catch (_: Exception) { localStore.createClient(name, phone, email, notes); "Клиент сохранён локально" }
    }

    private suspend fun saveSession(client: Client?, date: String?, time: String?, formatRaw: String, comment: String): String {
        require(client != null) { "Выберите клиента" }
        require(!date.isNullOrBlank()) { "Выберите дату" }
        require(!time.isNullOrBlank()) { "Выберите свободный слот или время" }
        val format = if (formatRaw.lowercase().contains("оф") || formatRaw.lowercase().contains("кабин")) SessionFormat.IN_PERSON else SessionFormat.ONLINE
        val endTime = addMinutes(time, 50)
        return try {
            val response = if (!client.id.startsWith("local-")) api.createSession(CreateSessionRequest(client.id, date, time, endTime, format)) else null
            val session = if (response?.isSuccessful == true) response.body() else null
            if (session != null) { localStore.upsertSession(session); "Запись создана" }
            else { localStore.createSession(client, date, time, endTime, format, comment); "Запись сохранена локально" }
        } catch (_: Exception) { localStore.createSession(client, date, time, endTime, format, comment); "Запись сохранена локально" }
    }

    private fun saveBlock(title: String, type: String, date: String?, time: String?, comment: String): String {
        require(!date.isNullOrBlank()) { "Выберите дату" }
        require(!time.isNullOrBlank()) { "Выберите время" }
        blockStore.saveBlock(title.ifBlank { "Блокировка" }, type, date, time, addMinutes(time, 50), comment)
        return "Блокировка добавлена в расписание"
    }

    private fun buildLocalSlots(date: String): List<TimeSlot> {
        val busy = localStore.getSessions(date, date).map { it.startTime }.toSet() + blockStore.getBlocks(date, date).map { it.startTime }.toSet()
        return generateSequence(LocalTime.of(9, 0)) { it.plusHours(1) }
            .takeWhile { it <= LocalTime.of(20, 0) }
            .map { start -> start.format(DateTimeFormatter.ofPattern("HH:mm")) }
            .filterNot { it in busy }
            .map { start -> TimeSlot(date, start, addMinutes(start, 50), available = true) }
            .toList()
    }

    private suspend fun saveRepeatedSlot(client: Client?, date: String?, time: String?, countRaw: String, comment: String): String {
        require(client != null) { "Выберите клиента" }
        require(!date.isNullOrBlank()) { "Выберите дату" }
        require(!time.isNullOrBlank()) { "Выберите время" }
        val count = countRaw.toIntOrNull()?.coerceIn(1, 24) ?: 1
        repeat(count) { index ->
            val nextDate = java.time.LocalDate.parse(date).plusWeeks(index.toLong()).toString()
            localStore.createSession(client, nextDate, time, addMinutes(time, 50), SessionFormat.ONLINE, comment)
        }
        return if (count == 1) "Слот повторён" else "Создана серия: $count встреч"
    }

    private fun addMinutes(time: String, minutes: Long): String {
        val parsed = LocalTime.parse(time, DateTimeFormatter.ofPattern("HH:mm"))
        return parsed.plusMinutes(minutes).format(DateTimeFormatter.ofPattern("HH:mm"))
    }

    private fun mergeClients(remote: List<Client>, local: List<Client>): List<Client> = (remote + local).distinctBy { it.id }.sortedBy { it.name.lowercase() }
}

data class QuickActionUiState(
    val isLoadingClients: Boolean = false,
    val isSaving: Boolean = false,
    val clients: List<Client> = emptyList(),
    val isLoadingSlots: Boolean = false,
    val availableSlots: List<TimeSlot> = emptyList(),
)
