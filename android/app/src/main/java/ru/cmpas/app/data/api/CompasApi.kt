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
    suspend fun getDashboard(): Response<DashboardData>

    // ── Sessions ──
    @GET("sessions")
    suspend fun getSessions(
        @Query("from") from: String? = null,
        @Query("to") to: String? = null,
        @Query("status") status: String? = null,
    ): Response<List<Session>>

    @POST("sessions")
    suspend fun createSession(@Body body: CreateSessionRequest): Response<Session>

    @PATCH("sessions/{id}")
    suspend fun updateSession(
        @Path("id") id: String,
        @Body body: UpdateSessionRequest,
    ): Response<Session>

    @DELETE("sessions/{id}")
    suspend fun cancelSession(@Path("id") id: String): Response<Unit>

    // ── Clients ──
    @GET("clients")
    suspend fun getClients(
        @Query("search") search: String? = null,
    ): Response<List<Client>>

    @POST("clients")
    suspend fun createClient(@Body body: CreateClientRequest): Response<Client>

    @GET("clients/{id}")
    suspend fun getClient(@Path("id") id: String): Response<Client>

    // ── Calendar / Booking ──
    @GET("calendar/slots")
    suspend fun getAvailableSlots(
        @Query("psychologistId") psychologistId: String,
        @Query("from") from: String,
        @Query("to") to: String,
    ): Response<List<TimeSlot>>

    @POST("calendar/book")
    suspend fun bookSlot(@Body body: BookSlotRequest): Response<Session>

    // ── Profile ──
    @GET("me")
    suspend fun getProfile(): Response<User>

    // ── FCM ──
    @POST("fcm/register")
    suspend fun registerFcmToken(@Body body: FcmTokenRequest): Response<Unit>
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
    val endTime: String,
    val format: SessionFormat,
    val videoLink: String? = null,
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
data class BookSlotRequest(
    val psychologistId: String,
    val date: String,
    val startTime: String,
    val endTime: String,
    val clientName: String,
    val clientEmail: String? = null,
    val clientPhone: String? = null,
)

@kotlinx.serialization.Serializable
data class FcmTokenRequest(val token: String)
