package ru.cmpas.app.data.api

import retrofit2.Response
import retrofit2.http.*
import ru.cmpas.app.domain.model.*

interface CompasApi {

    // ── Auth ──
    @POST("auth/login")
    suspend fun requestMagicLink(@Body body: MagicLinkRequest): Response<MagicLinkResponse>

    @POST("auth/verify")
    suspend fun verifyMagicLink(@Body body: VerifyRequest): Response<AuthTokens>

    @POST("auth/refresh")
    suspend fun refreshToken(@Body body: RefreshRequest): Response<AuthTokens>

    // ── Dashboard ──
    @GET("dashboard")
    suspend fun getDashboard(): Response<DashboardDataV2>

    // ── Sessions ──
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

    // Free times for reschedule
    @GET("sessions/free-times")
    suspend fun getFreeTimes(
        @Query("date") date: String,
        @Query("sessionId") sessionId: String? = null,
    ): Response<FreeTimesResponse>

    // ── Clients ──
    @GET("clients")
    suspend fun getClients(
        @Query("search") search: String? = null,
    ): Response<List<Client>>

    @POST("clients")
    suspend fun createClient(@Body body: CreateClientRequest): Response<Client>

    @GET("clients/{id}")
    suspend fun getClient(@Path("id") id: String): Response<ClientDetail>

    @PATCH("clients/{id}")
    suspend fun updateClient(
        @Path("id") id: String,
        @Body body: UpdateClientRequest,
    ): Response<Client>

    // Send message to client
    @POST("clients/{id}/message")
    suspend fun sendMessage(
        @Path("id") id: String,
        @Body body: SendMessageRequest,
    ): Response<SendMessageResponse>

    // Generate invite link for client to connect Telegram/MAX
    @POST("clients/{id}/invite")
    suspend fun createInviteLink(
        @Path("id") id: String,
        @Body body: InviteRequest,
    ): Response<InviteResponse>

    // New-client onboarding: options + send (notification + document)
    @GET("clients/{id}/onboarding")
    suspend fun getOnboardingOptions(
        @Path("id") id: String,
    ): Response<OnboardingOptions>

    @POST("clients/{id}/onboarding")
    suspend fun sendOnboarding(
        @Path("id") id: String,
        @Body body: OnboardingSendRequest,
    ): Response<OnboardingResult>

    // ── Schedule blocks ──
    @GET("blocks")
    suspend fun getBlocks(
        @Query("from") from: String? = null,
        @Query("to") to: String? = null,
    ): Response<List<TimeBlock>>

    @POST("blocks")
    suspend fun createBlock(@Body body: CreateBlockRequest): Response<CreateBlockResponse>

    @DELETE("blocks/{id}")
    suspend fun deleteBlock(@Path("id") id: String): Response<Unit>

    // ── Scheduled messages ──
    @GET("scheduled-messages")
    suspend fun getScheduledMessages(): Response<List<ScheduledMessage>>

    @POST("scheduled-messages")
    suspend fun scheduleMessage(@Body body: ScheduleMessageRequest): Response<ScheduledMessage>

    @DELETE("scheduled-messages/{id}")
    suspend fun deleteScheduledMessage(@Path("id") id: String): Response<Unit>

    // ── Profile ──
    @GET("me")
    suspend fun getProfile(): Response<User>

    // ── FCM ──
    @POST("fcm")
    suspend fun registerFcmToken(@Body body: FcmTokenRequest): Response<Unit>

    @DELETE("fcm")
    suspend fun unregisterFcmToken(): Response<Unit>
}

// ── Request bodies ──
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
    val duration: Int? = null,
)

@kotlinx.serialization.Serializable
data class UpdateSessionRequest(
    val status: SessionStatus? = null,
    val notes: String? = null,
    val date: String? = null,
    val startTime: String? = null,
)

@kotlinx.serialization.Serializable
data class CreateClientRequest(
    val name: String,
    val email: String? = null,
    val phone: String? = null,
)

@kotlinx.serialization.Serializable
data class UpdateClientRequest(
    val name: String? = null,
    val phone: String? = null,
    val email: String? = null,
    val status: String? = null,
)

@kotlinx.serialization.Serializable
data class FcmTokenRequest(val token: String)

@kotlinx.serialization.Serializable
data class SendMessageRequest(
    val type: String, // "custom" | "reminder"
    val text: String? = null,
    val sessionId: String? = null,
)

@kotlinx.serialization.Serializable
data class InviteRequest(val channel: String = "telegram")

@kotlinx.serialization.Serializable
data class CreateBlockRequest(
    val startDate: String,
    val endDate: String? = null,
    val type: String,
    val reason: String? = null,
    val cancelIntersectingSessions: Boolean = false,
)

@kotlinx.serialization.Serializable
data class ScheduleMessageRequest(
    val clientId: String,
    val sendAt: String,
    val type: String,
    val text: String? = null,
    val sessionId: String? = null,
)
