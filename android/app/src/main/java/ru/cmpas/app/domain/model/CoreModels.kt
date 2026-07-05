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
