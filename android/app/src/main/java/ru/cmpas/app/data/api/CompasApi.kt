package ru.cmpas.app.data.api

import kotlinx.serialization.json.JsonObject
import retrofit2.Response
import retrofit2.http.*
import ru.cmpas.app.domain.model.*

interface CompasApi {

    @POST("auth/login")
    suspend fun requestMagicLink(@Body body: MagicLinkRequest): Response<MagicLinkResponse>

    @POST("auth/verify")
    suspend fun verifyMagicLink(@Body body: VerifyRequest): Response<AuthTokens>

    @POST("auth/refresh")
    suspend fun refreshToken(@Body body: RefreshRequest): Response<AuthTokens>

    @GET("dashboard")
    suspend fun getDashboard(): Response<DashboardDataV2>

    @GET("sessions")
    suspend fun getSessions(
        @Query("from") from: String? = null,
        @Query("to") to: String? = null,
        @Query("status") status: String? = null,
    ): Response<List<Session>>

    @GET("sessions/{id}")
    suspend fun getSession(@Path("id") id: String): Response<Session>

    @POST("sessions")
    suspend fun createSession(@Body body: CreateSessionRequest): Response<Session>

    @PATCH("sessions/{id}")
    suspend fun updateSession(
        @Path("id") id: String,
        @Body body: UpdateSessionRequest,
    ): Response<Session>

    @DELETE("sessions/{id}")
    suspend fun cancelSession(@Path("id") id: String): Response<Unit>

    // Фактический исход напоминаний по сессии и повторная отправка.
    // До появления этих двух вызовов экран показывал «Отправлено», как только
    // проходил момент напоминания, — то есть по часам, а не по факту. Правду
    // знает сервер: он пишет каждую попытку в ReminderOutbox.
    @GET("sessions/{id}/reminders")
    suspend fun getSessionReminders(@Path("id") id: String): Response<SessionRemindersResponse>

    @POST("sessions/{id}/reminders")
    suspend fun resendSessionReminder(
        @Path("id") id: String,
        @Body body: ResendReminderRequest,
    ): Response<ResendReminderResponse>

    @GET("sessions/free-times")
    suspend fun getFreeTimes(
        @Query("date") date: String,
        @Query("sessionId") sessionId: String? = null,
    ): Response<FreeTimesResponse>

    @GET("clients")
    suspend fun getClients(@Query("search") search: String? = null): Response<List<Client>>

    @POST("clients")
    suspend fun createClient(@Body body: CreateClientRequest): Response<Client>

    @GET("clients/{id}")
    suspend fun getClient(@Path("id") id: String): Response<ClientDetail>

    @PATCH("clients/{id}")
    suspend fun updateClient(@Path("id") id: String, @Body body: UpdateClientRequest): Response<Client>

    @POST("clients/{id}/message")
    suspend fun sendMessage(@Path("id") id: String, @Body body: SendMessageRequest): Response<SendMessageResponse>

    @POST("clients/{id}/invite")
    suspend fun createInviteLink(@Path("id") id: String, @Body body: InviteRequest): Response<InviteResponse>

    @GET("clients/{id}/channels")
    suspend fun getClientChannels(@Path("id") id: String): Response<ClientChannelStatus>

    @POST("clients/{id}/channels")
    suspend fun createClientChannelInvite(@Path("id") id: String, @Body body: InviteRequest): Response<InviteResponse>

    @HTTP(method = "DELETE", path = "clients/{id}/channels", hasBody = true)
    suspend fun revokeClientChannel(@Path("id") id: String, @Body body: ChannelRequest): Response<Unit>

    @GET("clients/{id}/onboarding")
    suspend fun getOnboardingOptions(@Path("id") id: String): Response<OnboardingOptions>

    @POST("clients/{id}/onboarding")
    suspend fun sendOnboarding(@Path("id") id: String, @Body body: OnboardingSendRequest): Response<OnboardingResult>

    @GET("blocks")
    suspend fun getBlocks(@Query("from") from: String? = null, @Query("to") to: String? = null): Response<List<TimeBlock>>

    @POST("blocks")
    suspend fun createBlock(@Body body: CreateBlockRequest): Response<CreateBlockResponse>

    @DELETE("blocks/{id}")
    suspend fun deleteBlock(@Path("id") id: String): Response<Unit>

    @GET("availability")
    suspend fun getAvailability(): Response<AvailabilitySummary>

    @PATCH("availability/mode")
    suspend fun updateScheduleMode(@Body body: ScheduleModeRequest): Response<ScheduleModeResponse>

    @GET("scheduled-messages")
    suspend fun getScheduledMessages(): Response<List<ScheduledMessage>>

    @POST("scheduled-messages")
    suspend fun scheduleMessage(@Body body: ScheduleMessageRequest): Response<ScheduledMessage>

    @DELETE("scheduled-messages/{id}")
    suspend fun deleteScheduledMessage(@Path("id") id: String): Response<Unit>

    @GET("notifications")
    suspend fun getNotifications(@Query("cursor") cursor: String? = null, @Query("limit") limit: Int? = null): Response<NotificationsPage>

    @POST("notifications")
    suspend fun markNotificationsRead(@Body body: MarkNotificationsReadRequest): Response<Unit>

    @GET("me")
    suspend fun getProfile(): Response<User>

    @GET("legal/status")
    suspend fun getLegalStatus(): Response<MobileLegalStatus>

    @POST("legal/accept")
    suspend fun acceptLegal(@Body body: MobileLegalAcceptBody): Response<MobileLegalAcceptResponse>

    @POST("feature-interest")
    suspend fun markFeatureInterest(@Body body: FeatureInterestRequest): Response<FeatureInterestResponse>

    @POST("fcm")
    suspend fun registerFcmToken(@Body body: FcmTokenRequest): Response<Unit>

    @DELETE("fcm")
    suspend fun unregisterFcmToken(): Response<Unit>

    // ── Аналитика (Горизонт 1, этап 2б) ─────────────────────────────────
    //
    // Секрет ANALYTICS_INGEST_SECRET в APK не кладём — приложение шлёт
    // события обычным пользовательским JWT (см. AuthInterceptor), сервер сам
    // подставляет product:'practice' и account_id из токена. Согласие —
    // обычный аутентифицированный ресурс, не событие: GET читает его
    // состояние, PUT меняет. Конверт события в теле POST не несёт product,
    // account_id и device_id — их сервер подставляет сам.

    @GET("analytics/consent")
    suspend fun getAnalyticsConsent(): Response<AnalyticsConsentDto>

    @PUT("analytics/consent")
    suspend fun setAnalyticsConsent(@Body body: AnalyticsConsentRequest): Response<AnalyticsConsentDto>

    @POST("analytics")
    suspend fun postAnalyticsEvents(@Body body: List<AnalyticsEventEnvelope>): Response<AnalyticsIngestResponse>
}

@kotlinx.serialization.Serializable
data class MagicLinkRequest(val email: String)

@kotlinx.serialization.Serializable
data class MagicLinkResponse(val message: String, val success: Boolean)

@kotlinx.serialization.Serializable
data class VerifyRequest(val token: String)

@kotlinx.serialization.Serializable
data class RefreshRequest(val refreshToken: String)

@kotlinx.serialization.Serializable
data class CreateSessionRequest(
    val clientId: String,
    val date: String,
    val startTime: String,
    val endTime: String? = null,
    val format: SessionFormat = SessionFormat.ONLINE,
    val type: SessionType = SessionType.INDIVIDUAL,
    val duration: Int? = null,
    // Ключ идемпотентности, рождённый в момент постановки записи, а не в
    // момент отправки: повтор после потерянного ответа возвращает уже
    // созданную сессию, а не создаёт вторую.
    val clientRequestId: String? = null,
    // Комментарий к записи. Поля не было вовсе, и текст, введённый
    // пользователем в «Комментарий», молча пропадал на УСПЕШНОМ пути: он
    // доходил до локального хранилища только тогда, когда сервер отказал.
    val notes: String? = null,
)

@kotlinx.serialization.Serializable
data class UpdateSessionRequest(
    val status: SessionStatus? = null,
    val notes: String? = null,
    val structuredNotes: List<SmartNoteBlock>? = null,
    val date: String? = null,
    val startTime: String? = null,
    val paymentStatus: PaymentStatus? = null,
)

@kotlinx.serialization.Serializable
data class CreateClientRequest(
    val name: String,
    val email: String? = null,
    val phone: String? = null,
    val gender: String? = null,
    /** Ключ идемпотентности — см. CreateSessionRequest.clientRequestId. */
    val clientRequestId: String? = null,
)

@kotlinx.serialization.Serializable
data class UpdateClientRequest(val name: String? = null, val phone: String? = null, val email: String? = null, val status: String? = null)

@kotlinx.serialization.Serializable
data class FcmTokenRequest(val token: String)

@kotlinx.serialization.Serializable
data class NotificationsPage(val items: List<PracticeNotification>, val nextCursor: String? = null)

@kotlinx.serialization.Serializable
data class MarkNotificationsReadRequest(val ids: List<String>? = null)

@kotlinx.serialization.Serializable
data class SendMessageRequest(val type: String, val text: String? = null, val sessionId: String? = null)

@kotlinx.serialization.Serializable
data class InviteRequest(val channel: String = "auto")

@kotlinx.serialization.Serializable
data class ResendReminderRequest(val kind: String)

@kotlinx.serialization.Serializable
data class ResendReminderResponse(
    val sent: Boolean = false,
    val reason: String? = null,
    val message: String? = null,
)

@kotlinx.serialization.Serializable
data class SessionRemindersResponse(val reminders: List<ServerReminderStatus> = emptyList())

/** Строка ReminderOutbox: что сервер ФАКТИЧЕСКИ сделал с напоминанием. */
@kotlinx.serialization.Serializable
data class ServerReminderStatus(
    val kind: String,
    val channel: String,
    val status: String,
    val sentAt: String? = null,
    val sendCount: Int = 0,
)

@kotlinx.serialization.Serializable
data class ChannelRequest(val channel: String)

@kotlinx.serialization.Serializable
data class CreateBlockRequest(
    val startDate: String,
    val endDate: String? = null,
    val startTime: String? = null,
    val endTime: String? = null,
    val type: String,
    val reason: String? = null,
    val cancelIntersectingSessions: Boolean = false,
)

@kotlinx.serialization.Serializable
data class AvailabilitySummary(
    val scheduleMode: String = "private",
    val bookingBufferHours: Int = 24,
    val bookingHorizonDays: Int = 14,
    val cancellationHours: Int = 24,
    val rules: List<AvailabilityRule> = emptyList(),
    val slots: List<AvailabilitySlotDto> = emptyList(),
    val blocks: List<TimeBlock> = emptyList(),
)

@kotlinx.serialization.Serializable
data class AvailabilityRule(
    val id: String,
    val name: String,
    val priority: Int = 0,
    val isActive: Boolean = true,
    val color: String? = null,
    val format: String = "online",
    val duration: Int = 50,
    val breakDuration: Int = 15,
    val audienceFilter: String = "all",
    val startDate: String? = null,
    val endDate: String? = null,
)

@kotlinx.serialization.Serializable
data class AvailabilitySlotDto(
    val id: String,
    val ruleId: String? = null,
    val dayOfWeek: Int,
    val startTime: String,
    val endTime: String,
    val duration: Int = 50,
    val format: String = "online",
    val addressId: String? = null,
)

@kotlinx.serialization.Serializable
data class ScheduleModeRequest(val scheduleMode: String)

@kotlinx.serialization.Serializable
data class ScheduleModeResponse(val success: Boolean, val scheduleMode: String)

@kotlinx.serialization.Serializable
data class FeatureInterestRequest(val feature: String)

@kotlinx.serialization.Serializable
data class FeatureInterestResponse(
    val success: Boolean,
    val feature: String,
    val alreadyInList: Boolean = true,
    val count: Int = 0,
)

@kotlinx.serialization.Serializable
data class ScheduleMessageRequest(
    val clientId: String,
    val sendAt: String,
    val type: String,
    val text: String? = null,
    val sessionId: String? = null,
)

// ── Аналитика ────────────────────────────────────────────────────────────

/** Ответ GET/PUT `analytics/consent` — состояние согласия, каким его знает сервер. */
@kotlinx.serialization.Serializable
data class AnalyticsConsentDto(val granted: Boolean, val since: String? = null)

@kotlinx.serialization.Serializable
data class AnalyticsConsentRequest(val granted: Boolean)

/**
 * Конверт события в теле POST `analytics` — ровно то, что провод ждёт от
 * клиента: без product/account_id/device_id (их подставляет сервер) и без
 * секрета. `eventId` рождается очередью в момент постановки, а не здесь.
 */
@kotlinx.serialization.Serializable
data class AnalyticsEventEnvelope(
    val event: String,
    val ts: String,
    val props: JsonObject,
    @kotlinx.serialization.SerialName("schema_version") val schemaVersion: Int,
    @kotlinx.serialization.SerialName("event_id") val eventId: String,
)

/** Один элемент `results[]` — отказ приходит здесь, при HTTP 200, а не через код ответа. */
@kotlinx.serialization.Serializable
data class AnalyticsIngestResult(val accepted: Boolean, val reason: String? = null)

@kotlinx.serialization.Serializable
data class AnalyticsIngestResponse(val results: List<AnalyticsIngestResult> = emptyList())
