package ru.cmpas.app.domain.model

import kotlinx.serialization.ExperimentalSerializationApi
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonNames

@Serializable
data class User(
    val id: String,
    val name: String?,
    val email: String?,
    val role: UserRole = UserRole.PSYCHOLOGIST,
    val avatarUrl: String? = null,
    val telegramId: String? = null,
    val onlineSessionLink: String? = null,
    // Задача 20 §8: фактическое состояние подключения мессенджеров с сервера.
    // Экран профиля раньше рисовал «Telegram · Подключён» жёстко, независимо
    // от того, подключён ли он на самом деле.
    val telegramConnected: Boolean = false,
    val maxConnected: Boolean = false,
)

/**
 * Настройки автонапоминаний клиенту (Задача 20 §11). Ровно два поля — те,
 * за которыми стоит настоящая серверная рассылка: за сутки и за час.
 * Никакого «за 2 часа» на сервере нет.
 */
@Serializable
data class MobileNotificationSettings(
    val clientReminder25hEnabled: Boolean = true,
    val clientReminder1hEnabled: Boolean = true,
)

/** Меняется один тумблер за раз — второе поле остаётся нетронутым. */
@Serializable
data class MobileNotificationSettingsPatch(
    val clientReminder25hEnabled: Boolean? = null,
    val clientReminder1hEnabled: Boolean? = null,
)

/**
 * Кабинет практики (Задача 21).
 *
 * «Основной» — свойство набора, а не строки: на сервере его держит
 * PsychologistSettings.officeAddress, поэтому изменение одного кабинета
 * меняет метку и у другого, и список всегда приходит целиком.
 */
@Serializable
data class PracticeAddress(
    val id: String,
    val name: String,
    val address: String,
    val isPrimary: Boolean = false,
    val isActive: Boolean = true,
)

@Serializable
data class PracticeAddressList(
    val addresses: List<PracticeAddress> = emptyList(),
)

@Serializable
data class CreatePracticeAddressRequest(
    val name: String,
    val address: String,
)

/** Меняется только то, что передано: остальные поля кабинета не трогаются. */
@Serializable
data class UpdatePracticeAddressRequest(
    val name: String? = null,
    val address: String? = null,
    val isPrimary: Boolean? = null,
)

@Serializable
enum class UserRole { PSYCHOLOGIST, CLIENT }

@Serializable
data class SmartNoteBlock(
    val id: String,
    val definitionId: String,
    val values: Map<String, String> = emptyMap(),
    val createdAt: String? = null,
)

@Serializable
data class Session(
    val id: String,
    val clientId: String = "",
    val clientName: String = "",
    val date: String,
    @OptIn(ExperimentalSerializationApi::class)
    @JsonNames("time")
    val startTime: String = "00:00",
    val endTime: String = "",
    val status: SessionStatus = SessionStatus.PENDING,
    val format: SessionFormat = SessionFormat.ONLINE,
    val type: SessionType = SessionType.INDIVIDUAL,
    val videoLink: String? = null,
    val notes: String? = null,
    val notesPlain: String? = null,
    val structuredNotes: List<SmartNoteBlock>? = null,
    val seriesId: String? = null,
    val occurrenceIndex: Int? = null,
    val seriesTotal: Int? = null,
    val isAnchorOccurrence: Boolean = false,
    val paymentStatus: PaymentStatus = PaymentStatus.NOT_REQUIRED,
    val consentStatus: ConsentStatus = ConsentStatus.OK,
    val homeworkStatus: HomeworkStatus = HomeworkStatus.NOT_ASSIGNED,
    val previousNotesSummary: String? = null,
    val isRecurring: Boolean = false,
    val cadenceLabel: String? = null,
)

@Serializable
enum class SessionStatus { PENDING, CONFIRMED, COMPLETED, CANCELLED, NO_SHOW }

@Serializable
enum class SessionFormat { ONLINE, IN_PERSON }

@Serializable
enum class SessionType { INDIVIDUAL, COUPLE, FAMILY }

@Serializable
enum class PaymentStatus { PAID, UNPAID, PARTIAL, NOT_REQUIRED }

@Serializable
enum class ConsentStatus { OK, MISSING, EXPIRED }

@Serializable
enum class HomeworkStatus { DONE, PARTIAL, MISSING, NOT_ASSIGNED }
