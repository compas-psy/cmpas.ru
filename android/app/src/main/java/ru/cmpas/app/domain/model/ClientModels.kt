package ru.cmpas.app.domain.model

import kotlinx.serialization.Serializable

@Serializable
data class Client(
    val id: String,
    val name: String,
    val email: String? = null,
    val phone: String? = null,
    val gender: String? = null,
    val telegramId: String? = null,
    val maxId: String? = null,
    val sessionsCount: Int = 0,
    val lastSessionDate: String? = null,
    val lastSessionTime: String? = null,
    val notes: String? = null,
    val status: ClientStatus = ClientStatus.ACTIVE,
    val nextSessionDate: String? = null,
    val nextSessionTime: String? = null,
    val cadenceType: CadenceType = CadenceType.NONE,
    val anchorWeekday: Int? = null,
    val anchorTime: String? = null,
    val anchorFormat: SessionFormat? = null,
    val packageTotal: Int? = null,
    val packageCompleted: Int? = null,
    val pauseUntil: String? = null,
)

@Serializable
enum class ClientStatus { ACTIVE, PAUSED, ARCHIVED }

@Serializable
enum class CadenceType { NONE, WEEKLY_FIXED, BIWEEKLY, FLEXIBLE, PACKAGE, PAUSED }

@Serializable
data class ClientDetail(
    val id: String,
    val name: String,
    val email: String? = null,
    val phone: String? = null,
    val gender: String? = null,
    val telegramId: String? = null,
    val maxId: String? = null,
    val sessionsCount: Int = 0,
    val lastSessionDate: String? = null,
    val status: ClientStatus = ClientStatus.ACTIVE,
    val consentDate: String? = null,
    val recentSessions: List<Session> = emptyList(),
    val hasMessenger: Boolean = false,
    val messengerChannel: String? = null,
)

@Serializable
data class DashboardData(
    val todaySessions: List<Session>,
    val nextSession: Session?,
    val weekStats: WeekStats,
    val userName: String? = null,
    val attentionItems: List<AttentionItem> = emptyList(),
)

@Serializable
data class DashboardDataV2(
    val todaySessions: List<Session>,
    val nextSession: Session?,
    val weekStats: WeekStats,
    val userName: String? = null,
    val attentionItems: List<AttentionItem> = emptyList(),
    val notifications: List<PracticeNotification> = emptyList(),
    val bookingLink: String? = null,
    val needsOnboarding: Boolean = false,
    val onboardingUrl: String? = null,
)

@Serializable
data class WeekStats(
    val sessionsCount: Int,
    val newClients: Int,
    val cancelledCount: Int,
)

@Serializable
data class AttentionItem(
    val type: String,
    val count: Int,
    val label: String,
    val icon: String? = null,
)

@Serializable
data class PracticeNotification(
    val id: String,
    val type: String,
    val title: String,
    val subtitle: String? = null,
    val createdAt: String? = null,
    val sessionId: String? = null,
    val clientId: String? = null,
    val unread: Boolean = true,
)

@Serializable
data class TimeSlot(
    val date: String,
    val startTime: String,
    val endTime: String,
    val available: Boolean,
)

@Serializable
data class AuthTokens(
    val accessToken: String,
    val refreshToken: String,
    val expiresIn: Long,
)
