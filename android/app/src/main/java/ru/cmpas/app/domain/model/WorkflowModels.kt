package ru.cmpas.app.domain.model

import kotlinx.serialization.Serializable

@Serializable
data class SendMessageResponse(
    val status: String,
    val sentAt: String? = null,
    val readyText: String? = null,
    val phone: String? = null,
)

@Serializable
data class InviteResponse(
    val inviteLink: String,
    val channel: String,
    val expiresAt: String,
    val clientName: String,
    val phone: String? = null,
)

@Serializable
data class OnboardingDoc(
    val id: String,
    val title: String,
)

@Serializable
data class OnboardingOptions(
    val clientName: String,
    val phone: String? = null,
    val hasTelegram: Boolean = false,
    val hasMax: Boolean = false,
    val documents: List<OnboardingDoc> = emptyList(),
    val hasSession: Boolean = false,
)

@Serializable
data class OnboardingSendRequest(
    val channel: String,
    val sendNotification: Boolean,
    val documentId: String? = null,
)

@Serializable
data class OnboardingResult(
    val status: String,
    val channel: String,
    val inviteLink: String? = null,
    val readyText: String? = null,
    val phone: String? = null,
)

@Serializable
data class TimeBlock(
    val id: String,
    val date: String,
    val startTime: String,
    val endTime: String,
    val type: String,
    val reason: String? = null,
)

@Serializable
data class CreateBlockResponse(
    val ok: Boolean,
    val created: Int,
)

@Serializable
data class FreeTimesResponse(
    val date: String,
    val times: List<String>,
)

@Serializable
data class ScheduledMessage(
    val id: String,
    val clientId: String,
    val sessionId: String? = null,
    val channel: String,
    val text: String,
    val sendAt: String,
    val status: String,
    val readyText: String? = null,
)

@Serializable
enum class ReminderStatus { SCHEDULED, SENT, READ, FAILED }

@Serializable
data class SessionReminder(
    val id: String,
    val whenLabel: String,
    val atLabel: String,
    val channel: String,
    val status: ReminderStatus,
    val withPayment: Boolean,
    val text: String,
)
