package ru.cmpas.app.presentation.dashboard

import okhttp3.MediaType.Companion.toMediaType
import okhttp3.ResponseBody.Companion.toResponseBody
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test
import retrofit2.Response
import ru.cmpas.app.data.api.UpdateSessionRequest
import ru.cmpas.app.domain.model.Session
import ru.cmpas.app.domain.model.SessionStatus

/**
 * §3.2 приёмка для DashboardViewModel.markSessionOutcome().
 *
 * DashboardViewModel сам в JVM unit-тесте не собрать: один из его
 * конструкторных параметров, AnalyticsSession, — final-класс с настоящим
 * Android Context и DataStore-хранилищем внутри (через AnalyticsConsent →
 * UserPreferences), без единого тестового шва, и ни разу не участвует ни в
 * одном существующем тесте этого модуля. Тот же выбор уже сделан в
 * SettingsViewModelTest: проверяется не сам ViewModel, а вынесенная из него
 * чистая логика — здесь это outcomeUpdateRequest()/outcomeErrorMessage(),
 * которыми markSessionOutcome() дословно и пользуется.
 */
class DashboardViewModelTest {

    private fun sessionOf(status: SessionStatus) = Session(id = "s-1", date = "2026-08-29", status = status)

    @Test
    fun `outcomeUpdateRequest строит запрос с переданным статусом`() {
        assertEquals(UpdateSessionRequest(status = SessionStatus.COMPLETED), outcomeUpdateRequest(SessionStatus.COMPLETED))
        assertEquals(UpdateSessionRequest(status = SessionStatus.NO_SHOW), outcomeUpdateRequest(SessionStatus.NO_SHOW))
    }

    @Test
    fun `outcomeErrorMessage — null при успешном ответе`() {
        assertNull(outcomeErrorMessage(Response.success(sessionOf(SessionStatus.NO_SHOW))))
    }

    @Test
    fun `outcomeErrorMessage — текст ошибки при отказе сервера`() {
        val response = Response.error<Session>(500, "".toResponseBody("text/plain".toMediaType()))
        assertEquals("Не удалось отметить исход сессии", outcomeErrorMessage(response))
    }
}
