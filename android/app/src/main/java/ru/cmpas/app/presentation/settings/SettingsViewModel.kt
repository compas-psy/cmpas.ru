package ru.cmpas.app.presentation.settings

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import retrofit2.Response
import ru.cmpas.app.data.analytics.AnalyticsConsent
import ru.cmpas.app.data.api.CompasApi
import ru.cmpas.app.data.local.AnalyticsEventStore
import ru.cmpas.app.domain.model.DashboardDataV2
import ru.cmpas.app.domain.model.MobileLegalAcceptBody
import ru.cmpas.app.domain.model.MobileNotificationSettings
import ru.cmpas.app.domain.model.MobileNotificationSettingsPatch
import ru.cmpas.app.domain.model.MobileBillingStatus
import ru.cmpas.app.domain.model.MobileLegalStatus
import ru.cmpas.app.domain.model.MobilePaymentSettings
import ru.cmpas.app.domain.model.MobilePaymentSettingsPatch
import ru.cmpas.app.domain.model.MobilePracticeSettings
import ru.cmpas.app.domain.model.MobilePracticeSettingsPatch
import ru.cmpas.app.domain.model.MobileProfilePatch
import ru.cmpas.app.domain.model.NewSpecialistDocument
import ru.cmpas.app.domain.model.SpecialistDocument
import ru.cmpas.app.domain.model.User
import javax.inject.Inject

@HiltViewModel
class SettingsViewModel @Inject constructor(
    private val api: CompasApi,
    private val analyticsConsent: AnalyticsConsent,
    private val analyticsEventStore: AnalyticsEventStore,
) : ViewModel() {
    private val _uiState = MutableStateFlow(SettingsUiState())
    val uiState = _uiState.asStateFlow()

    init {
        refresh()
        loadAnalyticsConsent()
    }

    /**
     * Тумблер обязан сначала показать последнее известное состояние из
     * локального кэша (мгновенно, офлайн), а затем — актуальное состояние с
     * сервера, который остаётся источником истины. Кэш выключен по
     * умолчанию (см. AnalyticsConsent), поэтому до первого успешного ответа
     * сети тумблер честно показывает «выключено», а не зависает пустым.
     */
    fun loadAnalyticsConsent() {
        viewModelScope.launch {
            val cached = analyticsConsent.cached()
            _uiState.update { it.copy(analyticsConsentGranted = cached.granted) }
            analyticsConsent.refresh()?.let { fresh ->
                _uiState.update { it.copy(analyticsConsentGranted = fresh.granted) }
            }
        }
    }

    /**
     * Пишет согласие через ресурс `PUT /api/mobile/analytics/consent`. При
     * отзыве очищает и локальную очередь ещё не отправленных событий — отзыв
     * обязан не только остановить сбор, но и удалить уже собранное.
     */
    fun setAnalyticsConsent(granted: Boolean) {
        viewModelScope.launch {
            _uiState.update { it.copy(isSavingAnalyticsConsent = true, error = null) }
            analyticsConsent.setGranted(granted, onRevoked = { analyticsEventStore.clear() })
                .onSuccess { state ->
                    _uiState.update { it.copy(isSavingAnalyticsConsent = false, analyticsConsentGranted = state.granted) }
                }
                .onFailure {
                    _uiState.update { it.copy(isSavingAnalyticsConsent = false, error = "Не удалось обновить согласие на аналитику") }
                }
        }
    }

    fun refresh() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, error = null) }
            try {
                val profileResponse = api.getProfile()
                val legalResponse = api.getLegalStatus()
                val dashboardResponse = runCatching { api.getDashboard() }.getOrNull()
                // Тумблеры напоминаний показывают серверное состояние. Не
                // дошли до сервера — не показываем выдуманное: остаётся
                // последнее известное, а нового обещания экран не даёт.
                val remindersResponse = runCatching { api.getNotificationSettings() }.getOrNull()
                // Оплата и настройки практики — тем же правилом: не дошли,
                // остаётся последнее известное, выдуманного нет.
                val billingResponse = runCatching { api.getBilling() }.getOrNull()
                val practiceResponse = runCatching { api.getPracticeSettings() }.getOrNull()
                // Оплата клиентом: ссылка и напоминание перед встречей.
                val paymentResponse = runCatching { api.getPaymentSettings() }.getOrNull()
                // Документы САМОГО специалиста — те, что получает клиент.
                val documentsResponse = runCatching { api.getSpecialistDocuments() }.getOrNull()
                _uiState.update {
                    it.copy(
                        isLoading = false,
                        user = if (profileResponse.isSuccessful) profileResponse.body() else it.user,
                        legalStatus = if (legalResponse.isSuccessful) legalResponse.body() else it.legalStatus,
                        bookingLink = mergeBookingLink(dashboardResponse, it.bookingLink),
                        reminders = mergeReminders(remindersResponse, it.reminders),
                        billing = billingResponse?.takeIf { r -> r.isSuccessful }?.body() ?: it.billing,
                        practice = practiceResponse?.takeIf { r -> r.isSuccessful }?.body() ?: it.practice,
                        payment = paymentResponse?.takeIf { r -> r.isSuccessful }?.body() ?: it.payment,
                        documents = documentsResponse?.takeIf { r -> r.isSuccessful }?.body()?.documents ?: it.documents,
                        error = if (!legalResponse.isSuccessful) "Не удалось загрузить документы" else null,
                    )
                }
            } catch (_: Exception) {
                _uiState.update { it.copy(isLoading = false, error = "Ошибка подключения") }
            }
        }
    }

    /**
     * Задача 20 §11: тумблер меняет НАСТОЯЩУЮ настройку на сервере. До этого
     * оба напоминания жили в rememberSaveable — переключались, ничего не
     * меняли и забывались. Пока ответ не пришёл, показывается прежнее
     * состояние: рисовать желаемое как действительное нельзя.
     */
    fun setClientReminder(kind: ReminderKind, enabled: Boolean) {
        val current = _uiState.value.reminders ?: return
        viewModelScope.launch {
            _uiState.update { it.copy(savingReminder = kind, error = null) }
            val patch = when (kind) {
                ReminderKind.DAY_BEFORE -> MobileNotificationSettingsPatch(clientReminder25hEnabled = enabled)
                ReminderKind.HOUR_BEFORE -> MobileNotificationSettingsPatch(clientReminder1hEnabled = enabled)
                ReminderKind.MORNING_DIGEST -> MobileNotificationSettingsPatch(morningDigestEnabled = enabled)
                ReminderKind.WEEKLY_DIGEST -> MobileNotificationSettingsPatch(weeklyDigestEnabled = enabled)
                ReminderKind.MOOD_CHECK -> MobileNotificationSettingsPatch(clientMoodCheckEnabled = enabled)
            }
            try {
                val response = api.updateNotificationSettings(patch)
                val saved = response.body()
                if (!response.isSuccessful || saved == null) throw IllegalStateException()
                _uiState.update { it.copy(savingReminder = null, reminders = saved) }
            } catch (_: Exception) {
                _uiState.update { it.copy(savingReminder = null, reminders = current, error = "Не удалось сохранить напоминание") }
            }
        }
    }

    /**
     * Имя специалиста. Видно клиенту в каждом уведомлении — опечатка в нём
     * до сих пор исправлялась только из веб-кабинета.
     */
    fun saveName(name: String) {
        val trimmed = name.trim()
        if (trimmed.isBlank()) {
            _uiState.update { it.copy(error = "Имя не может быть пустым") }
            return
        }
        viewModelScope.launch {
            _uiState.update { it.copy(isSavingProfile = true, error = null) }
            try {
                val response = api.updateProfile(MobileProfilePatch(name = trimmed))
                val saved = response.body()
                if (!response.isSuccessful || saved == null) throw IllegalStateException()
                _uiState.update { it.copy(isSavingProfile = false, user = saved) }
            } catch (_: Exception) {
                _uiState.update { it.copy(isSavingProfile = false, error = "Не удалось сохранить имя") }
            }
        }
    }

    /**
     * Ссылка для онлайн-сессий: уходит клиенту в подтверждении записи и в
     * напоминаниях. Пустая строка означает «ссылки нет» — сервер запишет
     * null, а не пустоту в шаблон сообщения.
     */
    fun saveOnlineSessionLink(link: String) {
        viewModelScope.launch {
            _uiState.update { it.copy(isSavingPractice = true, error = null) }
            try {
                val response = api.updatePracticeSettings(MobilePracticeSettingsPatch(onlineSessionLink = link.trim()))
                val saved = response.body()
                if (!response.isSuccessful || saved == null) {
                    // 400 здесь означает одно: адрес не разбирается как ссылка.
                    throw IllegalStateException(if (response.code() == 400) "LINK" else "OTHER")
                }
                _uiState.update { it.copy(isSavingPractice = false, practice = saved) }
            } catch (error: Exception) {
                val message = if (error.message == "LINK") {
                    "Ссылка должна начинаться с http:// или https://"
                } else {
                    "Не удалось сохранить ссылку"
                }
                _uiState.update { it.copy(isSavingPractice = false, error = message) }
            }
        }
    }

    /**
     * Оплата клиентом: ссылка и напоминание перед встречей.
     *
     * Из ссылки рисуется QR-код, и оба уходят клиенту — в сообщении при
     * записи и в напоминании за выбранный срок. Интервал выбирает
     * специалист: решение учредителя 11.09.2026.
     *
     * ПРАКТИКА не связана с банками и поступление денег не видит; отметку об
     * оплате ставит сам специалист. Экран обязан это говорить, а не намекать
     * галочкой «оплачено».
     */
    fun savePaymentSettings(link: String, reminderEnabled: Boolean, hoursBefore: Int) {
        viewModelScope.launch {
            _uiState.update { it.copy(isSavingPayment = true, error = null) }
            try {
                val response = api.updatePaymentSettings(
                    MobilePaymentSettingsPatch(
                        // Ссылка есть — значит оплата настроена: отдельный
                        // тумблер «включить» на телефоне был бы вторым
                        // выключателем у одной лампочки.
                        isEnabled = link.isNotBlank(),
                        paymentLink = link.trim(),
                        paymentReminderEnabled = reminderEnabled,
                        paymentReminderHoursBefore = hoursBefore,
                    ),
                )
                val saved = response.body()
                if (!response.isSuccessful || saved == null) {
                    throw IllegalStateException(if (response.code() == 400) "LINK" else "OTHER")
                }
                _uiState.update { it.copy(isSavingPayment = false, payment = saved) }
            } catch (error: Exception) {
                val message = if (error.message == "LINK") {
                    "Ссылка должна начинаться с http:// или https://"
                } else {
                    "Не удалось сохранить настройки оплаты"
                }
                _uiState.update { it.copy(isSavingPayment = false, error = message) }
            }
        }
    }

    /**
     * Завести свой документ — названием и ссылкой на файл.
     *
     * Полный текст согласия на телефоне не набирают: у специалиста файл уже
     * есть. Текстовые документы остаются веб-кабинету, и шторка об этом
     * говорит прямо, а не молчит.
     */
    fun createDocument(title: String, fileUrl: String, sendOnNewClient: Boolean) {
        val trimmedTitle = title.trim()
        val trimmedUrl = fileUrl.trim()
        if (trimmedTitle.isBlank() || trimmedUrl.isBlank()) {
            _uiState.update { it.copy(error = "Нужны название и ссылка на файл") }
            return
        }
        viewModelScope.launch {
            _uiState.update { it.copy(isSavingDocument = true, error = null) }
            try {
                val response = api.createSpecialistDocument(
                    NewSpecialistDocument(
                        title = trimmedTitle,
                        fileUrl = trimmedUrl,
                        sendOnNewClient = sendOnNewClient,
                    ),
                )
                if (!response.isSuccessful) {
                    throw IllegalStateException(if (response.code() == 400) "LINK" else "OTHER")
                }
                _uiState.update { it.copy(isSavingDocument = false, documentSaved = true) }
                // Список перечитывается с сервера, а не дописывается на
                // экране: дописанный показывал бы документ, которого на
                // сервере может и не оказаться.
                refresh()
            } catch (error: Exception) {
                val message = if (error.message == "LINK") {
                    "Проверьте ссылку: она должна начинаться с http:// или https://"
                } else {
                    "Не удалось сохранить документ"
                }
                _uiState.update { it.copy(isSavingDocument = false, error = message) }
            }
        }
    }

    /** Шторка закрылась — признак «сохранено» больше не нужен. */
    fun documentSavedShown() {
        _uiState.update { it.copy(documentSaved = false) }
    }

    fun acceptRequiredDocuments() {
        val status = _uiState.value.legalStatus ?: return
        viewModelScope.launch {
            _uiState.update { it.copy(isSavingLegal = true, error = null) }
            try {
                val response = api.acceptLegal(
                    MobileLegalAcceptBody(acceptTerms = true, documentIds = status.requiredDocumentIds),
                )
                if (!response.isSuccessful) throw IllegalStateException()
                _uiState.update { it.copy(isSavingLegal = false) }
                refresh()
            } catch (_: Exception) {
                _uiState.update { it.copy(isSavingLegal = false, error = "Не удалось сохранить документы") }
            }
        }
    }

    fun setAdsConsent(accepted: Boolean) {
        viewModelScope.launch {
            _uiState.update { it.copy(isSavingLegal = true, error = null) }
            try {
                val response = api.acceptLegal(MobileLegalAcceptBody(acceptAds = accepted))
                if (!response.isSuccessful) throw IllegalStateException()
                _uiState.update { it.copy(isSavingLegal = false) }
                refresh()
            } catch (_: Exception) {
                _uiState.update { it.copy(isSavingLegal = false, error = "Не удалось обновить согласие") }
            }
        }
    }
}

/** Keeps the previously known booking link if the dashboard call failed or came back empty. */
internal fun mergeBookingLink(dashboardResponse: Response<DashboardDataV2>?, previous: String?): String? =
    dashboardResponse?.takeIf { it.isSuccessful }?.body()?.bookingLink ?: previous

/**
 * Настройки напоминаний берутся с сервера; неудачный запрос оставляет
 * последнее известное состояние, а не подставляет умолчания — иначе экран
 * показал бы «включено» там, где на сервере может быть выключено.
 */
internal fun mergeReminders(
    response: Response<MobileNotificationSettings>?,
    previous: MobileNotificationSettings?,
): MobileNotificationSettings? =
    response?.takeIf { it.isSuccessful }?.body() ?: previous

data class SettingsUiState(
    val isLoading: Boolean = false,
    val isSavingLegal: Boolean = false,
    val user: User? = null,
    val legalStatus: MobileLegalStatus? = null,
    val bookingLink: String? = null,
    val error: String? = null,
    // Выключено по умолчанию (fail-closed) — до ответа сервера тумблер не
    // показывает согласие включённым только потому, что состояние ещё не
    // загружено.
    val analyticsConsentGranted: Boolean = false,
    val isSavingAnalyticsConsent: Boolean = false,
    /**
     * null — серверное состояние ещё не получено. Тумблеры в этом случае не
     * показываются вовсе: тумблер без известного состояния — это выдумка.
     */
    val reminders: MobileNotificationSettings? = null,
    val savingReminder: ReminderKind? = null,
    /** null — состояние оплаты ещё не получено; выдумывать его нельзя. */
    val billing: MobileBillingStatus? = null,
    val practice: MobilePracticeSettings? = null,
    /** null — настройки оплаты ещё не получены с сервера. */
    val payment: MobilePaymentSettings? = null,
    val isSavingProfile: Boolean = false,
    val isSavingPractice: Boolean = false,
    val isSavingPayment: Boolean = false,
    /** Документы специалиста для клиентов: согласие, договор, памятка. */
    val documents: List<SpecialistDocument> = emptyList(),
    val isSavingDocument: Boolean = false,
    val documentSaved: Boolean = false,
)

/**
 * Уведомления, за которыми стоит НАСТОЯЩАЯ серверная рассылка.
 *
 * Список сверен с кодом отправки, а не с названиями полей таблицы: в
 * NotificationSettings есть ещё пять флагов (newBookingEnabled,
 * reminderEnabled, clientRescheduleEnabled, clientCancelEnabled,
 * clientPsyCancelEnabled), которых не читает никто — отправка идёт мимо
 * них. Тумблер, который ничего не выключает, — это обещание.
 */
enum class ReminderKind { DAY_BEFORE, HOUR_BEFORE, MORNING_DIGEST, WEEKLY_DIGEST, MOOD_CHECK }
