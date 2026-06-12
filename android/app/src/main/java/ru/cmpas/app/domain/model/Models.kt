package ru.cmpas.app.domain.model

import kotlinx.serialization.Serializable

// ═══════════════════════════════════════════
// User
// ═══════════════════════════════════════════

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

// ═══════════════════════════════════════════
// Session
// ═══════════════════════════════════════════

@Serializable
data class Session(
    val id: String,
    val clientId: String,
    val clientName: String,
    val date: String,        // ISO date "2024-04-22"
    val startTime: String,   // "HH:mm"
    val endTime: String,     // "HH:mm"
    val status: SessionStatus,
    val format: SessionFormat,
    val videoLink: String? = null,
    val notes: String? = null,
    // Smart scheduling
    val seriesId: String? = null,
    val occurrenceIndex: Int? = null,
    val seriesTotal: Int? = null,
    val isAnchorOccurrence: Boolean = false,
    // Status indicators
    val paymentStatus: PaymentStatus = PaymentStatus.NOT_REQUIRED,
    val consentStatus: ConsentStatus = ConsentStatus.OK,
    val homeworkStatus: HomeworkStatus = HomeworkStatus.NOT_ASSIGNED,
    // Context
    val previousNotesSummary: String? = null,
    val isRecurring: Boolean = false,
    val cadenceLabel: String? = null, // "каждую среду, 11:00"
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
enum class PaymentStatus {
    PAID, UNPAID, PARTIAL, NOT_REQUIRED
}

@Serializable
enum class ConsentStatus {
    OK, MISSING, EXPIRED
}

@Serializable
enum class HomeworkStatus {
    DONE, PARTIAL, MISSING, NOT_ASSIGNED
}

// ═══════════════════════════════════════════
// Client
// ═══════════════════════════════════════════

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
    // Smart scheduling
    val nextSessionDate: String? = null,
    val nextSessionTime: String? = null,
    val cadenceType: CadenceType = CadenceType.NONE,
    val anchorWeekday: Int? = null,   // 1=Mon..7=Sun
    val anchorTime: String? = null,   // "19:00"
    val anchorFormat: SessionFormat? = null,
    val packageTotal: Int? = null,
    val packageCompleted: Int? = null,
    val pauseUntil: String? = null,
)

@Serializable
enum class ClientStatus {
    ACTIVE, PAUSED, ARCHIVED
}

@Serializable
enum class CadenceType {
    NONE, WEEKLY_FIXED, BIWEEKLY, FLEXIBLE, PACKAGE, PAUSED
}

// ═══════════════════════════════════════════
// Dashboard
// ═══════════════════════════════════════════

@Serializable
data class DashboardData(
    val todaySessions: List<Session>,
    val nextSession: Session?,
    val weekStats: WeekStats,
    val userName: String? = null,
    val attentionItems: List<AttentionItem> = emptyList(),
)

@Serializable
data class WeekStats(
    val sessionsCount: Int,
    val newClients: Int,
    val cancelledCount: Int,
)

@Serializable
data class AttentionItem(
    val type: String,        // "consent", "payment", "report"
    val count: Int,
    val label: String,       // "2 клиента ожидают согласие"
    val icon: String? = null,
)

// ═══════════════════════════════════════════
// Calendar / Time
// ═══════════════════════════════════════════

@Serializable
data class TimeSlot(
    val date: String,
    val startTime: String,
    val endTime: String,
    val available: Boolean,
)

// ═══════════════════════════════════════════
// Auth
// ═══════════════════════════════════════════

@Serializable
data class AuthTokens(
    val accessToken: String,
    val refreshToken: String,
    val expiresIn: Long,
)

// ═══════════════════════════════════════════
// Notes
// ═══════════════════════════════════════════

// ═══════════════════════════════════════════
// Client detail (extended)
// ═══════════════════════════════════════════

@Serializable
data class ClientDetail(
    val id: String,
    val name: String,
    val email: String? = null,
    val phone: String? = null,
    val telegramId: String? = null,
    val maxId: String? = null,
    val sessionsCount: Int = 0,
    val lastSessionDate: String? = null,
    val status: ClientStatus = ClientStatus.ACTIVE,
    val consentDate: String? = null,
    val recentSessions: List<Session> = emptyList(),
    val hasMessenger: Boolean = false,
    val messengerChannel: String? = null, // "telegram" | "max" | null
)

// ═══════════════════════════════════════════
// Messaging
// ═══════════════════════════════════════════

@Serializable
data class SendMessageResponse(
    val status: String,  // "telegram" | "max" | "manual"
    val sentAt: String? = null,
    val readyText: String? = null, // for manual delivery
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

// ── New-client onboarding ──
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
    val channel: String,            // "telegram" | "max"
    val sendNotification: Boolean,
    val documentId: String? = null,
)

@Serializable
data class OnboardingResult(
    val status: String,             // "sent" | "pending"
    val channel: String,
    val inviteLink: String? = null,
    val readyText: String? = null,
    val phone: String? = null,
)

// ═══════════════════════════════════════════
// Schedule blocks
// ═══════════════════════════════════════════

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

// ═══════════════════════════════════════════
// Free times for reschedule
// ═══════════════════════════════════════════

@Serializable
data class FreeTimesResponse(
    val date: String,
    val times: List<String>, // ["10:00", "11:00", ...]
)

// ═══════════════════════════════════════════
// Scheduled messages
// ═══════════════════════════════════════════

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

// ═══════════════════════════════════════════
// Dashboard with booking link
// ═══════════════════════════════════════════

@Serializable
data class DashboardDataV2(
    val todaySessions: List<Session>,
    val nextSession: Session?,
    val weekStats: WeekStats,
    val userName: String? = null,
    val attentionItems: List<AttentionItem> = emptyList(),
    val bookingLink: String? = null,
)

@Serializable
data class SessionNote(
    val id: String,
    val sessionId: String,
    val clientId: String,
    val clientName: String,
    val date: String,
    val sessionNumber: Int? = null,
    val blocks: List<NoteBlock> = emptyList(),
    val plainText: String? = null,
    val createdAt: String? = null,
)

@Serializable
data class NoteBlock(
    val type: String,    // "request", "observation", "intervention", "dynamics", "next_step"
    val title: String,
    val content: String = "",
    val hint: String? = null,
)
