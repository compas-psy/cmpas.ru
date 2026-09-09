package ru.cmpas.app.presentation.schedule

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.ResponseBody.Companion.toResponseBody
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import retrofit2.Response
import ru.cmpas.app.data.api.AvailabilitySlotDto
import ru.cmpas.app.data.api.AvailabilitySummary
import ru.cmpas.app.data.api.CreateSlotRequest
import ru.cmpas.app.data.api.CreateSlotResponse
import ru.cmpas.app.data.api.FakeCompasApi
import ru.cmpas.app.data.api.UpdateSlotRequest

/**
 * Правка расписания с телефона.
 *
 * Задача из отчёта учредителя: «в мобилке нельзя корректировать расписание».
 * До этой правки мобильный API умел его только читать.
 *
 * Проверяется не «запрос ушёл», а то, что решает исход для человека:
 *
 *   1. День уходит на сервер тот, который правили, а не «все выбранные».
 *   2. Отказ сервера доезжает до экрана СЛОВАМИ. Сервер отвечает
 *      «Расписание пересекается с существующим: Вт 10:00–18:00» — это
 *      единственная подсказка, из которой понятно, что мешает сохранить;
 *      заменить её на «Ошибка (400)» значит оставить человека наедине с
 *      формой, которая молча не сохраняется.
 *   3. Список перечитывается только после удачи: показать изменение,
 *      которого сервер не принял, — это обещать клиентам часы, которых нет.
 */
class ScheduleSlotsTest {

    @Before fun setUp() { Dispatchers.setMain(UnconfinedTestDispatcher()) }
    @After fun tearDown() { Dispatchers.resetMain() }

    private fun <T> errorResponse(code: Int, body: String): Response<T> =
        Response.error(code, body.toResponseBody("application/json".toMediaType()))

    private val emptySummary = AvailabilitySummary()

    private class SlotsApi(
        val onCreate: (suspend (CreateSlotRequest) -> Response<CreateSlotResponse>)? = null,
        val onUpdate: (suspend (String, UpdateSlotRequest) -> Response<Unit>)? = null,
        val onDelete: (suspend (String) -> Response<Unit>)? = null,
        val summary: AvailabilitySummary = AvailabilitySummary(),
    ) : FakeCompasApi() {
        var lastCreate: CreateSlotRequest? = null
        var lastUpdateId: String? = null
        var lastUpdate: UpdateSlotRequest? = null
        var lastDeleteId: String? = null
        var reloads = 0

        override suspend fun getAvailability(): Response<AvailabilitySummary> {
            reloads++
            return Response.success(summary)
        }

        override suspend fun createSlot(body: CreateSlotRequest): Response<CreateSlotResponse> {
            lastCreate = body
            return onCreate!!.invoke(body)
        }

        override suspend fun updateSlot(id: String, body: UpdateSlotRequest): Response<Unit> {
            lastUpdateId = id
            lastUpdate = body
            return onUpdate!!.invoke(id, body)
        }

        override suspend fun deleteSlot(id: String): Response<Unit> {
            lastDeleteId = id
            return onDelete!!.invoke(id)
        }
    }

    @Test
    fun `часы заводятся тому дню, который правили`() = runTest {
        val api = SlotsApi(onCreate = { Response.success(CreateSlotResponse(created = 1)) }, summary = emptySummary)
        val viewModel = ScheduleViewModel(api)
        var ok = false

        viewModel.addSlot(
            dayOfWeek = 1, startTime = "15:00", endTime = "21:00", duration = 50,
            format = "offline", addressId = "a-1",
            startDate = "2026-09-01", endDate = "2026-12-31", scheduleRuleId = "rule-1",
        ) { success, _ -> ok = success }

        assertTrue(ok)
        // Именно один день, а не список выбранных: с телефона правят
        // конкретный вторник, а не собирают правило заново.
        assertEquals(listOf(1), api.lastCreate?.daysOfWeek)
        assertEquals("15:00", api.lastCreate?.startTime)
        assertEquals("rule-1", api.lastCreate?.scheduleRuleId)
    }

    @Test
    fun `отказ сервера доезжает до экрана словами`() = runTest {
        val api = SlotsApi(
            onCreate = { errorResponse(400, """{"error":"Расписание пересекается с существующим: Вт 10:00–18:00"}""") },
        )
        val viewModel = ScheduleViewModel(api)
        var ok = true
        var message = ""

        viewModel.addSlot(
            dayOfWeek = 1, startTime = "12:00", endTime = "20:00", duration = 50,
            format = "online", addressId = null,
            startDate = "2026-09-01", endDate = "2026-12-31", scheduleRuleId = null,
        ) { success, text -> ok = success; message = text }

        assertFalse(ok)
        assertTrue(message, message.contains("пересекается"))
        assertTrue(message, message.contains("10:00"))
        // Список НЕ перечитан: сервер изменение не принял, показывать нечего.
        assertEquals(1, api.reloads)
    }

    @Test
    fun `правка уходит тому окну, по которому нажали`() = runTest {
        val api = SlotsApi(onUpdate = { _, _ -> Response.success(Unit) })
        val viewModel = ScheduleViewModel(api)
        var ok = false

        viewModel.updateSlot("slot-вечер", "16:00", "21:00", 60, "both", "a-2") { success, _ -> ok = success }

        assertTrue(ok)
        assertEquals("slot-вечер", api.lastUpdateId)
        assertEquals("16:00", api.lastUpdate?.startTime)
        assertEquals(60, api.lastUpdate?.duration)
    }

    @Test
    fun `удаляется одно окно, а не день целиком`() = runTest {
        val api = SlotsApi(onDelete = { Response.success(Unit) })
        val viewModel = ScheduleViewModel(api)
        var ok = false

        viewModel.deleteSlot("slot-утро") { success, _ -> ok = success }

        assertTrue(ok)
        assertEquals("slot-утро", api.lastDeleteId)
    }

    @Test
    fun `непонятный отказ не превращается в пустое сообщение`() = runTest {
        // Тело без поля error (шлюз отдал HTML, оборвалась связь) не должно
        // оставить человека с пустой строкой вместо объяснения.
        val api = SlotsApi(onDelete = { errorResponse(502, "<html>Bad Gateway</html>") })
        val viewModel = ScheduleViewModel(api)
        var message = ""
        viewModel.deleteSlot("slot-утро") { _, text -> message = text }
        assertTrue(message, message.isNotBlank())
    }

    @Test
    fun `удачная правка перечитывает расписание`() = runTest {
        val summary = AvailabilitySummary(
            slots = listOf(AvailabilitySlotDto(id = "s1", dayOfWeek = 1, startTime = "15:00", endTime = "21:00")),
        )
        val api = SlotsApi(onUpdate = { _, _ -> Response.success(Unit) }, summary = summary)
        val viewModel = ScheduleViewModel(api)

        viewModel.updateSlot("s1", "15:00", "20:00", 50, "online", null) { _, _ -> }

        // Один раз при создании ViewModel и один после удачной правки.
        assertEquals(2, api.reloads)
        assertEquals("15:00", viewModel.uiState.value.slots.firstOrNull()?.startTime)
    }
}
