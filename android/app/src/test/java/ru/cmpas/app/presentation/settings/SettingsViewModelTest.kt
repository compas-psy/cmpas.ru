package ru.cmpas.app.presentation.settings

import okhttp3.MediaType.Companion.toMediaType
import okhttp3.ResponseBody.Companion.toResponseBody
import org.junit.Assert.assertEquals
import org.junit.Test
import retrofit2.Response
import ru.cmpas.app.domain.model.AttentionItem
import ru.cmpas.app.domain.model.DashboardDataV2
import ru.cmpas.app.domain.model.WeekStats

class SettingsViewModelTest {

    private fun dashboardOf(bookingLink: String?) = DashboardDataV2(
        todaySessions = emptyList(),
        nextSession = null,
        weekStats = WeekStats(0, 0, 0),
        attentionItems = emptyList<AttentionItem>(),
        bookingLink = bookingLink,
    )

    @Test
    fun `takes the link from a successful response`() {
        val response = Response.success(dashboardOf("https://cmpas.ru/bot/book/abc"))
        assertEquals("https://cmpas.ru/bot/book/abc", mergeBookingLink(response, previous = null))
    }

    @Test
    fun `keeps the previous link when the response failed`() {
        val response = Response.error<DashboardDataV2>(500, "".toResponseBody("text/plain".toMediaType()))
        assertEquals("https://cmpas.ru/bot/book/old", mergeBookingLink(response, previous = "https://cmpas.ru/bot/book/old"))
    }

    @Test
    fun `keeps the previous link when the call threw and there is no response`() {
        assertEquals("https://cmpas.ru/bot/book/old", mergeBookingLink(null, previous = "https://cmpas.ru/bot/book/old"))
    }

    @Test
    fun `keeps the previous link when the body came back without one`() {
        val response = Response.success(dashboardOf(null))
        assertEquals("https://cmpas.ru/bot/book/old", mergeBookingLink(response, previous = "https://cmpas.ru/bot/book/old"))
    }
}
