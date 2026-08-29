package ru.cmpas.app.presentation.session

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.ResponseBody.Companion.toResponseBody
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Before
import org.junit.Test
import retrofit2.Response
import ru.cmpas.app.data.analytics.AnalyticsRecorder
import ru.cmpas.app.data.api.FakeCompasApi
import ru.cmpas.app.data.api.UpdateSessionRequest
import ru.cmpas.app.domain.model.Session
import ru.cmpas.app.domain.model.SessionStatus

/**
 * §3.2 приёмка: noShow() и маршрутизация updateStatus("NO_SHOW") — раньше не
 * вызывались ниоткуда (мёртвый код), теперь это единственная точка,
 * гарантирующая, что кнопка в SessionDetailScreen дойдёт до сервера.
 */
class SessionDetailViewModelTest {

    @Before
    fun setUp() {
        Dispatchers.setMain(UnconfinedTestDispatcher())
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    private fun sessionOf(status: SessionStatus) = Session(id = "s-1", date = "2026-08-29", status = status)

    /** Согласие на аналитику всегда отключено — эти тесты проверяют не её, а сам вызов API. */
    private fun noAnalytics() = AnalyticsRecorder(isConsentGranted = { false }, enqueue = { })

    @Test
    fun `noShow отправляет UpdateSessionRequest со статусом NO_SHOW и обновляет session`() = runTest {
        var capturedId: String? = null
        var capturedBody: UpdateSessionRequest? = null
        val api = FakeCompasApi(onUpdateSession = { id, body ->
            capturedId = id
            capturedBody = body
            Response.success(sessionOf(SessionStatus.NO_SHOW))
        })
        val viewModel = SessionDetailViewModel(api, noAnalytics())

        viewModel.noShow("s-1")

        assertEquals("s-1", capturedId)
        assertEquals(UpdateSessionRequest(status = SessionStatus.NO_SHOW), capturedBody)
        assertEquals(SessionStatus.NO_SHOW, viewModel.uiState.value.session?.status)
        assertNull(viewModel.uiState.value.actionError)
    }

    @Test
    fun `noShow при отказе сервера выставляет actionError и не трогает session`() = runTest {
        val api = FakeCompasApi(onUpdateSession = { _, _ ->
            Response.error<Session>(500, "".toResponseBody("text/plain".toMediaType()))
        })
        val viewModel = SessionDetailViewModel(api, noAnalytics())

        viewModel.noShow("s-1")

        assertNull(viewModel.uiState.value.session)
        assertEquals("Ошибка", viewModel.uiState.value.actionError)
    }

    @Test
    fun `updateStatus маршрутизирует NO_SHOW в noShow()`() = runTest {
        var capturedBody: UpdateSessionRequest? = null
        val api = FakeCompasApi(onUpdateSession = { _, body ->
            capturedBody = body
            Response.success(sessionOf(SessionStatus.NO_SHOW))
        })
        val viewModel = SessionDetailViewModel(api, noAnalytics())

        viewModel.updateStatus("s-1", "NO_SHOW")

        assertEquals(SessionStatus.NO_SHOW, capturedBody?.status)
        assertEquals(SessionStatus.NO_SHOW, viewModel.uiState.value.session?.status)
    }

    @Test
    fun `updateStatus маршрутизирует строчными буквами тоже`() = runTest {
        var capturedBody: UpdateSessionRequest? = null
        val api = FakeCompasApi(onUpdateSession = { _, body ->
            capturedBody = body
            Response.success(sessionOf(SessionStatus.NO_SHOW))
        })
        val viewModel = SessionDetailViewModel(api, noAnalytics())

        viewModel.updateStatus("s-1", "no_show")

        assertEquals(SessionStatus.NO_SHOW, capturedBody?.status)
    }
}
