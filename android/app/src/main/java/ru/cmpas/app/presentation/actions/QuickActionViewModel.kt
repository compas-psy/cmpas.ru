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

data class OnboardingInfo(
    val clientId: String,
    val clientName: String,
    val phone: String?,
    val sessionId: String?,
)

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
                _uiState.update {
                    it.copy(
                        isLoadingClients = false,
                        clients = mergeClients(remoteClients, localStore.getClients()),
                    )
                }
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
                val slots = if (response.isSuccessful) {
                    response.body()?.times.orEmpty().map { start ->
                        TimeSlot(date, start, addMinutes(start, 50), available = true)
                    }
                } else emptyList()
                _uiState.update {
                    it.copy(
                        isLoadingSlots = false,
                        availableSlots = if (slots.isNotEmpty()) slots else fallback,
                    )
                }
            } catch (_: Exception) {
                _uiState.update { it.copy(isLoadingSlots = false, availableSlots = fallback) }
            }
        }
    }

    fun createClient(
        name: String,
        phone: String,
        email: String,
        gender: String?,
        onFinished: (Boolean, String) -> Unit,
    ) {
        viewModelScope.launch {
            _uiState.update { it.copy(isSaving = true) }
            runCatching { saveClient(name, phone, email, gender) }
                .onSuccess { message ->
                    _uiState.update { it.copy(isSaving = false) }
                    PracticeRefreshBus.notifyChanged()
                    loadClients()
                    if (_uiState.value.onboardingInfo == null) {
                        onFinished(true, message)
                    }
                }
                .onFailure { error ->
                    _uiState.update { it.copy(isSaving = false) }
                    onFinished(false, error.message ?: "Не удалось добавить клиента")
                }
        }
    }

    fun createSession(
        client: Client?,
        date: String?,
        time: String?,
        type: SessionType,
        format: SessionFormat,
        comment: String,
        onFinished: (Boolean, String, Boolean) -> Unit,
    ) {
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
                    "payment" -> "Оплата отмечена"
                    "booking-link" -> "Ссылка записи подготовлена для ${selectedClient?.name ?: "клиента"}"
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
                _uiState.update {
                    it.copy(
                        isOnboardingBusy = false,
                        onboardingOptions = if (response.isSuccessful) response.body() else null,
                    )
                }
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
                _uiState.update {
                    it.copy(
                        isOnboardingBusy = false,
                        onboardingResult = if (response.isSuccessful) response.body() else null,
                    )
                }
            } catch (_: Exception) {
                _uiState.update { it.copy(isOnboardingBusy = false) }
            }
        }
    }

    fun dismissOnboarding() = _uiState.update {
        it.copy(onboardingInfo = null, onboardingOptions = null, onboardingResult = null)
    }

    private suspend fun saveClient(name: String, phone: String, email: String, gender: String?): String {
        require(name.isNotBlank()) { "Укажите имя клиента" }
        require(email.isBlank() || android.util.Patterns.EMAIL_ADDRESS.matcher(email.trim()).matches()) {
            "Проверьте адрес электронной почты"
        }

        return try {
            val response = api.createClient(
                CreateClientRequest(
                    name = name.trim(),
                    email = email.trim().ifBlank { null },
                    phone = phone.trim().ifBlank { null },
                    gender = gender,
                ),
            )
            val client = if (response.isSuccessful) response.body() else null
            if (client != null) {
                localStore.upsertClient(client)
                val options = if (client.telegramId.isNullOrBlank() && client.maxId.isNullOrBlank()) {
                    runCatching {
                        val optionsResponse = api.getOnboardingOptions(client.id)
                        if (optionsResponse.isSuccessful) optionsResponse.body() else null
                    }.getOrNull()
                } else null
                if (options != null && (options.documents.isNotEmpty() || options.hasSession)) {
                    _uiState.update {
                        it.copy(
                            onboardingInfo = OnboardingInfo(
                                clientId = client.id,
                                clientName = client.name,
                                phone = client.phone,
                                sessionId = null,
                            ),
                            onboardingOptions = options,
                            isOnboardingBusy = false,
                        )
                    }
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

    private suspend fun saveSession(
        client: Client?,
        date: String?,
        time: String?,
        type: SessionType,
        format: SessionFormat,
        comment: String,
    ): String {
        require(client != null) { "Выберите клиента" }
        require(!date.isNullOrBlank()) { "Выберите дату" }
        require(!time.isNullOrBlank()) { "Выберите свободный слот или другое время" }
        val endTime = addMinutes(time, 50)

        if (client.id.startsWith("local-")) {
            localStore.createSession(client, date, time, endTime, format, type, comment)
            return "Запись добавлена на устройстве"
        }

        val response = api.createSession(
            CreateSessionRequest(
                clientId = client.id,
                date = date,
                startTime = time,
                endTime = endTime,
                format = format,
                type = type,
                duration = 50,
            ),
        )
        if (!response.isSuccessful) {
            val message = when (response.code()) {
                409 -> "Это время уже занято. Выберите другой слот"
                400 -> "Проверьте клиента, дату и время"
                else -> "Не удалось добавить запись (${response.code()})"
            }
            throw IllegalStateException(message)
        }

        val session = response.body() ?: throw IllegalStateException("Сервис не вернул созданную запись")
        localStore.upsertSession(session)
        if (client.telegramId.isNullOrBlank() && client.maxId.isNullOrBlank() && client.sessionsCount == 0) {
            _uiState.update {
                it.copy(
                    onboardingInfo = OnboardingInfo(
                        clientId = client.id,
                        clientName = client.name,
                        phone = client.phone,
                        sessionId = session.id,
                    ),
                )
            }
        }
        return "Запись добавлена"
    }

    private fun buildLocalSlots(date: String): List<TimeSlot> {
        val busy = localStore.getSessions(date, date).map { it.startTime }.toSet()
        return generateSequence(LocalTime.of(9, 0)) { it.plusHours(1) }
            .takeWhile { it <= LocalTime.of(20, 0) }
            .map { start -> start.format(DateTimeFormatter.ofPattern("HH:mm")) }
            .filterNot { it in busy }
            .map { start -> TimeSlot(date, start, addMinutes(start, 50), available = true) }
            .toList()
    }

    private fun saveRepeatedSlot(client: Client?, date: String?, time: String?, countRaw: String, comment: String): String {
        require(client != null) { "Выберите клиента" }
        require(!date.isNullOrBlank()) { "Выберите дату" }
        require(!time.isNullOrBlank()) { "Выберите время" }
        val count = countRaw.toIntOrNull()?.coerceIn(1, 24) ?: 1
        repeat(count) { index ->
            val nextDate = java.time.LocalDate.parse(date).plusWeeks(index.toLong()).toString()
            localStore.createSession(
                client = client,
                date = nextDate,
                startTime = time,
                endTime = addMinutes(time, 50),
                format = SessionFormat.ONLINE,
                notes = comment,
            )
        }
        return if (count == 1) "Слот повторён" else "Создана серия: $count встреч"
    }

    private fun addMinutes(time: String, minutes: Long): String {
        val parsed = LocalTime.parse(time, DateTimeFormatter.ofPattern("HH:mm"))
        return parsed.plusMinutes(minutes).format(DateTimeFormatter.ofPattern("HH:mm"))
    }

    private fun mergeClients(remote: List<Client>, local: List<Client>): List<Client> =
        (remote + local).distinctBy { it.id }.sortedBy { it.name.lowercase() }
}

data class QuickActionUiState(
    val isLoadingClients: Boolean = false,
    val isSaving: Boolean = false,
    val clients: List<Client> = emptyList(),
    val isLoadingSlots: Boolean = false,
    val availableSlots: List<TimeSlot> = emptyList(),
    val onboardingInfo: OnboardingInfo? = null,
    val isOnboardingBusy: Boolean = false,
    val onboardingOptions: OnboardingOptions? = null,
    val onboardingResult: OnboardingResult? = null,
)
