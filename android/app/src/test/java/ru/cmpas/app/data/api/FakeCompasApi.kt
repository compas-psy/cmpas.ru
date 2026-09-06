package ru.cmpas.app.data.api

import retrofit2.Response
import ru.cmpas.app.domain.model.*

private fun notStubbedResponse(name: String): Nothing = error("FakeCompasApi.$name() не переопределён в этом тесте")

/**
 * Тестовый двойник CompasApi — только для JVM unit-тестов ViewModel'ей.
 *
 * По умолчанию каждый метод падает с понятной ошибкой: тест обязан
 * переопределить ровно те методы, которые реально дёргает проверяемый код.
 * Так тест, случайно задевший незапланированный вызов сети, падает сразу и
 * явно, а не тихо возвращает пустой ответ.
 */
open class FakeCompasApi(
    /**
     * И SessionDetailViewModel, и DashboardViewModel в этой задаче вызывают
     * ровно один эндпоинт — updateSession() — поэтому именно он вынесен в
     * конструктор, а не оставлен на переопределение подклассом.
     */
    private val onUpdateSession: suspend (id: String, body: UpdateSessionRequest) -> Response<Session> = { _, _ -> notStubbedResponse("updateSession") },
) : CompasApi {

    override suspend fun updateSession(id: String, body: UpdateSessionRequest): Response<Session> = onUpdateSession(id, body)

    private fun notStubbed(name: String): Nothing = error("FakeCompasApi.$name() не переопределён в этом тесте")

    override suspend fun requestMagicLink(body: MagicLinkRequest): Response<MagicLinkResponse> = notStubbed("requestMagicLink")
    override suspend fun verifyMagicLink(body: VerifyRequest): Response<AuthTokens> = notStubbed("verifyMagicLink")
    override suspend fun refreshToken(body: RefreshRequest): Response<AuthTokens> = notStubbed("refreshToken")
    override suspend fun getDashboard(): Response<DashboardDataV2> = notStubbed("getDashboard")
    override suspend fun getSessions(from: String?, to: String?, status: String?): Response<List<Session>> = notStubbed("getSessions")
    override suspend fun getSession(id: String): Response<Session> = notStubbed("getSession")
    override suspend fun createSession(body: CreateSessionRequest): Response<Session> = notStubbed("createSession")
    override suspend fun cancelSession(id: String): Response<Unit> = notStubbed("cancelSession")
    override suspend fun getSessionReminders(id: String): Response<SessionRemindersResponse> = notStubbed("getSessionReminders")
    override suspend fun resendSessionReminder(id: String, body: ResendReminderRequest): Response<ResendReminderResponse> = notStubbed("resendSessionReminder")
    override suspend fun getFreeTimes(date: String, sessionId: String?): Response<FreeTimesResponse> = notStubbed("getFreeTimes")
    override suspend fun getClients(search: String?): Response<List<Client>> = notStubbed("getClients")
    override suspend fun createClient(body: CreateClientRequest): Response<Client> = notStubbed("createClient")
    override suspend fun getClient(id: String): Response<ClientDetail> = notStubbed("getClient")
    override suspend fun updateClient(id: String, body: UpdateClientRequest): Response<Client> = notStubbed("updateClient")
    override suspend fun sendMessage(id: String, body: SendMessageRequest): Response<SendMessageResponse> = notStubbed("sendMessage")
    override suspend fun createInviteLink(id: String, body: InviteRequest): Response<InviteResponse> = notStubbed("createInviteLink")
    override suspend fun getClientChannels(id: String): Response<ClientChannelStatus> = notStubbed("getClientChannels")
    override suspend fun createClientChannelInvite(id: String, body: InviteRequest): Response<InviteResponse> = notStubbed("createClientChannelInvite")
    override suspend fun revokeClientChannel(id: String, body: ChannelRequest): Response<Unit> = notStubbed("revokeClientChannel")
    override suspend fun getOnboardingOptions(id: String): Response<OnboardingOptions> = notStubbed("getOnboardingOptions")
    override suspend fun sendOnboarding(id: String, body: OnboardingSendRequest): Response<OnboardingResult> = notStubbed("sendOnboarding")
    override suspend fun getBlocks(from: String?, to: String?): Response<List<TimeBlock>> = notStubbed("getBlocks")
    override suspend fun createBlock(body: CreateBlockRequest): Response<CreateBlockResponse> = notStubbed("createBlock")
    override suspend fun deleteBlock(id: String): Response<Unit> = notStubbed("deleteBlock")
    override suspend fun getAvailability(): Response<AvailabilitySummary> = notStubbed("getAvailability")
    override suspend fun updateScheduleMode(body: ScheduleModeRequest): Response<ScheduleModeResponse> = notStubbed("updateScheduleMode")
    override suspend fun getScheduledMessages(): Response<List<ScheduledMessage>> = notStubbed("getScheduledMessages")
    override suspend fun scheduleMessage(body: ScheduleMessageRequest): Response<ScheduledMessage> = notStubbed("scheduleMessage")
    override suspend fun deleteScheduledMessage(id: String): Response<Unit> = notStubbed("deleteScheduledMessage")
    override suspend fun getNotifications(cursor: String?, limit: Int?): Response<NotificationsPage> = notStubbed("getNotifications")
    override suspend fun markNotificationsRead(body: MarkNotificationsReadRequest): Response<Unit> = notStubbed("markNotificationsRead")
    override suspend fun getProfile(): Response<User> = notStubbed("getProfile")

    override suspend fun getNotificationSettings(): Response<MobileNotificationSettings> = notStubbed("getNotificationSettings")

    override suspend fun updateNotificationSettings(body: MobileNotificationSettingsPatch): Response<MobileNotificationSettings> =
        notStubbed("updateNotificationSettings")
    override suspend fun getAddresses(): Response<PracticeAddressList> = notStubbed("getAddresses")
    override suspend fun createAddress(body: CreatePracticeAddressRequest): Response<PracticeAddress> = notStubbed("createAddress")
    override suspend fun updateAddress(id: String, body: UpdatePracticeAddressRequest): Response<PracticeAddressList> = notStubbed("updateAddress")
    override suspend fun deactivateAddress(id: String): Response<PracticeAddressList> = notStubbed("deactivateAddress")
    override suspend fun postOnboardingAction(body: PracticeOnboardingAction): Response<PracticeOnboarding> = notStubbed("postOnboardingAction")
    override suspend fun getLegalStatus(): Response<MobileLegalStatus> = notStubbed("getLegalStatus")
    override suspend fun acceptLegal(body: MobileLegalAcceptBody): Response<MobileLegalAcceptResponse> = notStubbed("acceptLegal")
    override suspend fun markFeatureInterest(body: FeatureInterestRequest): Response<FeatureInterestResponse> = notStubbed("markFeatureInterest")
    override suspend fun registerFcmToken(body: FcmTokenRequest): Response<Unit> = notStubbed("registerFcmToken")
    override suspend fun unregisterFcmToken(): Response<Unit> = notStubbed("unregisterFcmToken")
    override suspend fun getAnalyticsConsent(): Response<AnalyticsConsentDto> = notStubbed("getAnalyticsConsent")
    override suspend fun setAnalyticsConsent(body: AnalyticsConsentRequest): Response<AnalyticsConsentDto> = notStubbed("setAnalyticsConsent")
    override suspend fun postAnalyticsEvents(body: List<AnalyticsEventEnvelope>): Response<AnalyticsIngestResponse> = notStubbed("postAnalyticsEvents")
}
