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
    // Задача 24: полноценное состояние чек-листа с сервера — то же, что видит
    // веб. Старые поля остаются ради уже установленных сборок.
    val onboarding: PracticeOnboarding? = null,
    val needsOnboarding: Boolean = false,
    val onboardingUrl: String? = null,
)

/**
 * Чек-лист настройки практики (Задача 24).
 *
 * Три шага сервер ВЫЧИСЛЯЕТ из настоящих данных практики, четвёртый —
 * «поделиться» — по отметке о состоявшемся действии. Приложение эти шаги не
 * считает и отметить их не может: оно только показывает и сообщает о двух
 * действиях человека (поделился, скрыл).
 */
@Serializable
data class PracticeOnboarding(
    val dismissed: Boolean = false,
    val completed: Boolean = false,
    /** Ни клиентов, ни расписания, ни записей — только такому предлагают выбор входа. */
    val empty: Boolean = false,
    val steps: PracticeOnboardingSteps = PracticeOnboardingSteps(),
)

@Serializable
data class PracticeOnboardingSteps(
    val client: Boolean = false,
    val schedule: Boolean = false,
    val session: Boolean = false,
    val share: Boolean = false,
)

/** Имя состоявшегося действия, а не «новое состояние»: шаги отметить нельзя. */
@Serializable
data class PracticeOnboardingAction(val action: String)

@Serializable
data class WeekStats(
    val sessionsCount: Int,
    val newClients: Int,
    val cancelledCount: Int,
)

/**
 * Задача 17: пункт «требует внимания» приходит с сервера уже конкретным —
 * с идентификатором объекта, который нужно открыть, а не счётчиком «4 сессии
 * без заметок». Идентификаторы рождаются на сервере под текущим
 * специалистом (см. src/lib/practice/attention.ts).
 */
@Serializable
data class AttentionItem(
    val id: String = "",
    val type: String,
    val label: String,
    val title: String = "",
    val detail: String = "",
    val sessionId: String? = null,
    val clientId: String? = null,
    val batchId: String? = null,
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
