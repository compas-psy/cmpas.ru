package ru.cmpas.app.domain.model

import kotlinx.serialization.Serializable

@Serializable
data class User(
    val id: String,
    val name: String?,
    val email: String?,
    val role: UserRole = UserRole.PSYCHOLOGIST,
    val avatarUrl: String? = null,
    val telegramId: String? = null,
)

@Serializable
enum class UserRole {
    PSYCHOLOGIST, CLIENT
}

@Serializable
data class Session(
    val id: String,
    val clientId: String,
    val clientName: String,
    val date: String,        // ISO date
    val startTime: String,   // "HH:mm"
    val endTime: String,     // "HH:mm"
    val status: SessionStatus,
    val format: SessionFormat,
    val videoLink: String? = null,
    val notes: String? = null,
)

@Serializable
enum class SessionStatus {
    PENDING, CONFIRMED, COMPLETED, CANCELLED, NO_SHOW
}

@Serializable
enum class SessionFormat {
    ONLINE, IN_PERSON
}

@Serializable
data class Client(
    val id: String,
    val name: String,
    val email: String? = null,
    val phone: String? = null,
    val telegramId: String? = null,
    val sessionsCount: Int = 0,
    val lastSessionDate: String? = null,
    val notes: String? = null,
    val status: ClientStatus = ClientStatus.ACTIVE,
)

@Serializable
enum class ClientStatus {
    ACTIVE, PAUSED, ARCHIVED
}

@Serializable
data class DashboardData(
    val todaySessions: List<Session>,
    val nextSession: Session?,
    val weekStats: WeekStats,
)

@Serializable
data class WeekStats(
    val sessionsCount: Int,
    val newClients: Int,
    val cancelledCount: Int,
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
