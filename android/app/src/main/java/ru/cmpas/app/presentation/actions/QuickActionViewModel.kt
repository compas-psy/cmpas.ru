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
import ru.cmpas.app.domain.model.Client
import ru.cmpas.app.domain.model.OnboardingOptions
import ru.cmpas.app.domain.model.OnboardingResult
import ru.cmpas.app.domain.model.OnboardingSendRequest
import ru.cmpas.app.domain.model.SessionFormat
import ru.cmpas.app.domain.model.SessionType
import ru.cmpas.app.domain.model.TimeSlot
import ru.cmpas.app.presentation.util.PracticeRefreshBus
import java.time.LocalTime
import java.time.format.DateTimeFormatter
import javax.inject.Inject

data class OnboardingInfo(val clientId: String, val clientName: String, val phone: String?, val sessionId: String?)

@HiltViewModel
class QuickActionViewModel @Inject constructor(
    private val api: CompasApi,
    private val localStore: LocalPracticeStore,
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
                remoteClients.forEach(localStore::upsertClient)
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
                val response = api.getFreeTimes(date = date)
                val slots = if (response.isSuccessful) response.body()?.times.orEmpty().map { TimeSlot(date, it, addMinutes(it, 50), available = true) } else emptyList()
                _uiState.update { it.copy(isLoadingSlots = false, availableSlots = if (slots.isNotEmpty()) slots else fallback) }
            } catch (_: Exception) {
                _uiState.update { it.copy(isLoadingSlots = false, availableSlots = fallback) }
            }
        }
    }

    fun createClient(name: String, phone: String, email: String, gender: String?, onFinished: (Boolean, String) -> Unit) {
        viewModelScope.launch {
            _uiState.update { it.copy(isSaving = true) }
            runCatching { saveClient(name, phone, email, gender) }
                .onSuccess { message ->
                    _uiState.update { it.copy(isSaving = false) }
                    PracticeRefreshBus.notifyChanged()
                    loadClients()
                    if (_uiState.value.onboardingInfo == null) onFinished(true, message)
                }
                .onFailure { error ->
                    _uiState.update { it.copy(isSaving = false) }
                    onFinished(false, error.message ?: "Не удалось добавить клиента")
                }
        }
    }

    fun createSession(client: Client?, date: String?, time: String?, type: SessionType, format: SessionFormat, comment: String, onFinished: (Boolean, String, Boolean) -> Unit) {
        viewModelScope.launch {
            _uiState.update { it.copy(isSaving = true) }
            runCatching { saveSession(client, date, time, type, format, comment) }
                .onSuccess { message ->
                    _uiState.update { it.copy(isSaving = false) }
                    PracticeRefreshBus.notifyChanged()
                    loadClients()
                    onFinished(true, message, _uiState.value.onboardingInfo != null)
                }
                .onFailure { error ->
                    _uiState.update { it.copy(isSaving = false) }
                    onFinished(false, error.message ?: "Не удалось добавить запись", false)
                }
        }
    }

    fun saveGenericAction(
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
            runCatching {
                when (type) {
                    "repeat-slot" -> saveRepeatedSlot(selectedClient, date, time, secondary, comment)
                    "payment" -> throw IllegalStateException("Откройте конкретную сессию и отметьте оплату там — так статус синхронизируется с вебом")
                    else -> "Сохранено"
                }
            }.onSuccess { message ->
                _uiState.update { it.copy(isSaving = false) }
                PracticeRefreshBus.notifyChanged()
                onFinished(true, message)
            }.onFailure { error ->
                _uiState.update { it.copy(isSaving = false) }
                onFinished(false, error.message ?: "Не удалось сохранить")
            }
        }
    }

    fun loadOnboardingOptions(clientId: String) {
        viewModelScope.launch {
            _uiState.update { it.copy(isOnboardingBusy = true) }
            try {
                val response = api.getOnboardingOptions(clientId)
                _uiState.update { it.copy(isOnboardingBusy = false, onboardingOptions = if (response.isSuccessful) response.body() else null) }
            } catch (_: Exception) {
                _uiState.update { it.copy(isOnboardingBusy = false) }
            }
        }
    }

    fun submitOnboarding(clientId: String, channel: String, sendNotification: Boolean, documentId: String?) {
        viewModelScope.launch {
            _uiState.update { it.copy(isOnboardingBusy = true) }
            try {
                val response = api.sendOnboarding(clientId, OnboardingSendRequest(channel, sendNotification, documentId))
                _uiState.update { it.copy(isOnboardingBusy = false, onboardingResult = if (response.isSuccessful) response.body() else null) }
            } catch (_: Exception) {
                _uiState.update { it.copy(isOnboardingBusy = false) }
            }
        }
    }

    fun dismissOnboarding() = _uiState.update { it.copy(onboardingInfo = null, onboardingOptions = null, onboardingResult = null) }

    private suspend fun saveClient(name: String, phone: String, email: String, gender: String?): String {
        require(name.isNotBlank()) { "Укажите имя клиента" }
        require(email.isBlank() || android.util.Patterns.EMAIL_ADDRESS.matcher(email.trim()).matches()) { "Проверьте адрес электронной почты" }
        return try {
            val response = api.createClient(CreateClientRequest(name.trim(), email.trim().ifBlank { null }, phone.trim().ifBlank { null }, gender))
            val client = if (response.isSuccessful) response.body() else null
            if (client != null) {
                localStore.upsertClient(client)
                val options = if (client.telegramId.isNullOrBlank() && client.maxId.isNullOrBlank()) {
                    runCatching { api.getOnboardingOptions(client.id).takeIf { it.isSuccessful }?.body() }.getOrNull()
                } else null
                if (options != null && (options.documents.isNotEmpty() || options.hasSession)) {
                    _uiState.update { it.copy(onboardingInfo = OnboardingInfo(client.id, client.name, client.phone, null), onboardingOptions = options, isOnboardingBusy = false) }
                }
                "Клиент добавлен"
            } else {
                localStore.createClient(name.trim(), phone, email, gender, null)
                "Клиент сохранён на устройстве"
            }
        } catch (_: Exception) {
            localStore.createClient(name.trim(), phone, email, gender, null)
            "Клиент сохранён на устройстве"
        }
    }

    private suspend fun saveSession(client: Client?, date: String?, time: String?, type: SessionType, format: SessionFormat, comment: String): String {
        require(client != null) { "Выберите клиента" }
        require(!date.isNullOrBlank()) { "Выберите дату" }
        require(!time.isNullOrBlank()) { "Выберите время" }
        return try {
            val response = api.createSession(CreateSessionRequest(client!!.id, date!!, time!!, format = format, type = type))
            val session = if (response.isSuccessful) response.body() else null
            if (session != null) {
                localStore.upsertSession(session)
                val options = runCatching { api.getOnboardingOptions(client.id).takeIf { it.isSuccessful }?.body() }.getOrNull()
                if (options != null && (options.documents.isNotEmpty() || options.hasSession)) {
                    _uiState.update { it.copy(onboardingInfo = OnboardingInfo(client.id, client.name, client.phone, session.id), onboardingOptions = options, isOnboardingBusy = false) }
                }
                "Запись добавлена"
            } else {
                localStore.createSession(client, date, time, addMinutes(time, 50), format, type, comment)
                "Запись сохранена на устройстве"
            }
        } catch (_: Exception) {
            localStore.createSession(client!!, date!!, time!!, addMinutes(time, 50), format, type, comment)
            "Запись сохранена на устройстве"
        }
    }

    private suspend fun saveRepeatedSlot(client: Client?, date: String?, time: String?, secondary: String, comment: String): String {
        require(client != null) { "Выберите клиента" }
        require(!date.isNullOrBlank() && !time.isNullOrBlank()) { "Выберите дату и время" }
        val count = secondary.filter { it.isDigit() }.toIntOrNull()?.coerceIn(2, 12) ?: 4
        repeat(count) { index ->
            val nextDate = java.time.LocalDate.parse(date).plusWeeks(index.toLong()).toString()
            localStore.createSession(client!!, nextDate, time!!, addMinutes(time, 50), SessionFormat.ONLINE, SessionType.INDIVIDUAL, comment)
        }
        return "Создано повторов: $count"
    }

    private fun buildLocalSlots(date: String): List<TimeSlot> = listOf("10:00", "12:00", "15:00", "17:00").map { TimeSlot(date, it, addMinutes(it, 50), true) }
    private fun addMinutes(value: String, minutes: Long): String = LocalTime.parse(value).plusMinutes(minutes).format(DateTimeFormatter.ofPattern("HH:mm"))
}

data class QuickActionUiState(
    val isSaving: Boolean = false,
    val isLoadingClients: Boolean = false,
    val isLoadingSlots: Boolean = false,
    val clients: List<Client> = emptyList(),
    val availableSlots: List<TimeSlot> = emptyList(),
    val onboardingInfo: OnboardingInfo? = null,
    val onboardingOptions: OnboardingOptions? = null,
    val onboardingResult: OnboardingResult? = null,
    val isOnboardingBusy: Boolean = false,
)

private fun mergeClients(remote: List<Client>, local: List<Client>): List<Client> {
    val byId = linkedMapOf<String, Client>()
    remote.forEach { byId[it.id] = it }
    local.forEach { byId.putIfAbsent(it.id, it) }
    return byId.values.sortedBy { it.name.lowercase() }
}
