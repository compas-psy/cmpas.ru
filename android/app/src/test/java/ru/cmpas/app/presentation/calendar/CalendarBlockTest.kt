package ru.cmpas.app.presentation.calendar

import androidx.test.core.app.ApplicationProvider
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
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import retrofit2.Response
import ru.cmpas.app.data.api.CreateBlockRequest
import ru.cmpas.app.data.api.FakeCompasApi
import ru.cmpas.app.data.local.LocalPracticeStore
import ru.cmpas.app.domain.model.CreateBlockResponse
import ru.cmpas.app.domain.model.Session
import ru.cmpas.app.domain.model.TimeBlock
import java.time.LocalDate

/**
 * Приёмка Задачи 22 по блокировке времени.
 *
 * Правило, ради которого задача заведена: блокировка существует только тогда,
 * когда о ней знает сервер. Локально нарисованная блокировка — это обещание
 * клиенту времени, которого у специалиста нет: экран показал бы «вечер
 * закрыт», а самозапись всё равно предложила бы эти часы.
 *
 * Очередь досылки (LocalPracticeStore) знает клиента, сессию и заметку;
 * блокировок в ней нет, и в этой задаче она не расширяется. Значит при
 * отказе сети правильный исход ровно один — честная ошибка и открытая форма.
 * Хранилище здесь настоящее (Robolectric), а не переписанная копия: копия
 * проверяла бы копию.
 */
@RunWith(RobolectricTestRunner::class)
class CalendarBlockTest {

    private lateinit var store: LocalPracticeStore

    @Before
    fun setUp() {
        Dispatchers.setMain(UnconfinedTestDispatcher())
        store = LocalPracticeStore(ApplicationProvider.getApplicationContext())
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    private fun <T> failure(code: Int): Response<T> =
        Response.error(code, "".toResponseBody("application/json".toMediaType()))

    /** Двойник: календарь читает сессии и блокировки, блокировку создаёт. */
    private class CalendarApi(
        val onCreate: suspend (CreateBlockRequest) -> Response<CreateBlockResponse>,
        val blocksAfter: List<TimeBlock> = emptyList(),
    ) : FakeCompasApi() {
        var createCalls = 0
        var blockCalls = 0
        var sessionCalls = 0

        override suspend fun createBlock(body: CreateBlockRequest): Response<CreateBlockResponse> {
            createCalls++
            lastBody = body
            return onCreate(body)
        }

        override suspend fun getBlocks(from: String?, to: String?): Response<List<TimeBlock>> {
            blockCalls++
            return Response.success(if (createCalls > 0) blocksAfter else emptyList())
        }

        override suspend fun getSessions(from: String?, to: String?, status: String?): Response<List<Session>> {
            sessionCalls++
            return Response.success(emptyList())
        }

        var lastBody: CreateBlockRequest? = null
    }

    private fun okCreate(blocksAfter: List<TimeBlock> = emptyList()) = CalendarApi(
        onCreate = { Response.success(CreateBlockResponse(ok = true, created = 1)) },
        blocksAfter = blocksAfter,
    )

    private fun viewModelWith(api: CalendarApi) = CalendarViewModel(api, store)

    // ── Дата ──

    @Test
    fun `сегодня уходит на сервер как сегодняшняя дата`() = runTest {
        val api = okCreate()
        val today = LocalDate.now()

        viewModelWith(api).createBlock(today, "14:00", "17:00", null)

        assertEquals(today.toString(), api.lastBody?.startDate)
        assertEquals(today.toString(), api.lastBody?.endDate)
    }

    @Test
    fun `завтра уходит на сервер как завтрашняя дата`() = runTest {
        val api = okCreate()
        val tomorrow = LocalDate.now().plusDays(1)

        viewModelWith(api).createBlock(tomorrow, "14:00", "17:00", null)

        assertEquals(tomorrow.toString(), api.lastBody?.startDate)
    }

    @Test
    fun `выбранная дата уходит как есть — блокировка на один день, а не на период`() = runTest {
        val api = okCreate()
        val picked = LocalDate.of(2026, 11, 17)

        viewModelWith(api).createBlock(picked, "09:00", "10:00", null)

        assertEquals("2026-11-17", api.lastBody?.startDate)
        assertEquals("2026-11-17", api.lastBody?.endDate)
    }

    // ── Время и причина ──

    @Test
    fun `начало и конец уходят на сервер`() = runTest {
        val api = okCreate()

        viewModelWith(api).createBlock(LocalDate.now(), "14:00", "17:00", null)

        assertEquals("14:00", api.lastBody?.startTime)
        assertEquals("17:00", api.lastBody?.endTime)
    }

    @Test
    fun `причина необязательна, но если введена — доходит до сервера`() = runTest {
        val withReason = okCreate()
        viewModelWith(withReason).createBlock(LocalDate.now(), "14:00", "17:00", "Врач")
        assertEquals("Врач", withReason.lastBody?.reason)

        val withoutReason = okCreate()
        viewModelWith(withoutReason).createBlock(LocalDate.now(), "14:00", "17:00", "   ")
        assertNull(withoutReason.lastBody?.reason)
    }

    @Test
    fun `назначенные встречи не отменяются`() = runTest {
        val api = okCreate()

        viewModelWith(api).createBlock(LocalDate.now(), "14:00", "17:00", "Врач")

        assertFalse(api.lastBody!!.cancelIntersectingSessions)
    }

    // ── Валидация ──

    @Test
    fun `конец раньше или равен началу до сервера не доходит`() = runTest {
        val api = okCreate()
        val viewModel = viewModelWith(api)

        viewModel.createBlock(LocalDate.now(), "17:00", "14:00", null)
        assertEquals(0, api.createCalls)
        assertNotNull(viewModel.uiState.value.blockError)

        viewModel.createBlock(LocalDate.now(), "14:00", "14:00", null)
        assertEquals(0, api.createCalls)
    }

    @Test
    fun `та же граница проверяется чистой функцией — её же зовёт форма`() {
        assertNull(blockTimeError("14:00", "17:00"))
        assertNotNull(blockTimeError("17:00", "14:00"))
        assertNotNull(blockTimeError("14:00", "14:00"))
        assertNotNull(blockTimeError("вечером", "17:00"))
        assertNotNull(blockTimeError("25:00", "26:00"))
    }

    // ── Успех ──

    @Test
    fun `после подтверждения сервера форму можно закрыть и календарь перечитан`() = runTest {
        val api = okCreate(blocksAfter = listOf(
            TimeBlock(id = "b-1", date = LocalDate.now().toString(), startTime = "14:00", endTime = "17:00", type = "personal", reason = "Врач"),
        ))
        val viewModel = viewModelWith(api)
        val sessionCallsBefore = api.sessionCalls

        viewModel.createBlock(LocalDate.now(), "14:00", "17:00", "Врач")

        assertTrue(viewModel.uiState.value.blockSaved)
        assertNull(viewModel.uiState.value.blockError)
        // Состояние календаря перечитано с сервера, а не дорисовано локально.
        assertTrue(api.sessionCalls > sessionCallsBefore)
        assertTrue(viewModel.uiState.value.sessions.any { it.id == "block-b-1" })
    }

    @Test
    fun `признак подтверждения гасится, чтобы не сработать дважды`() = runTest {
        val viewModel = viewModelWith(okCreate())

        viewModel.createBlock(LocalDate.now(), "14:00", "17:00", null)
        assertTrue(viewModel.uiState.value.blockSaved)

        viewModel.consumeBlockSaved()
        assertFalse(viewModel.uiState.value.blockSaved)
    }

    // ── Отказ ──

    @Test
    fun `нет сети — честная ошибка, а не успех`() = runTest {
        val api = CalendarApi(onCreate = { throw java.io.IOException("нет сети") })
        val viewModel = viewModelWith(api)

        viewModel.createBlock(LocalDate.now(), "14:00", "17:00", "Врач")

        assertFalse(viewModel.uiState.value.blockSaved)
        assertEquals(
            "Не удалось заблокировать время. Проверьте подключение и попробуйте снова.",
            viewModel.uiState.value.blockError,
        )
    }

    @Test
    fun `отказ сервера не рисует блокировку в календаре`() = runTest {
        val api = CalendarApi(onCreate = { failure(500) })
        val viewModel = viewModelWith(api)

        viewModel.createBlock(LocalDate.now(), "14:00", "17:00", null)

        assertFalse(viewModel.uiState.value.blockSaved)
        assertNotNull(viewModel.uiState.value.blockError)
        assertTrue(viewModel.uiState.value.sessions.none { it.id.startsWith("block-") })
    }

    @Test
    fun `недоехавшая блокировка не попадает в очередь досылки`() = runTest {
        val api = CalendarApi(onCreate = { throw java.io.IOException("нет сети") })
        val viewModel = viewModelWith(api)

        viewModel.createBlock(LocalDate.now(), "14:00", "17:00", "Врач")

        // Очередь знает клиента, сессию и заметку — блокировки в ней нет, и
        // подсовывать её туда под видом сессии нельзя.
        assertEquals(emptyList<Any>(), store.getOutbox())
        assertTrue(store.getSessions().none { it.clientId == "local-block" })
    }

    @Test
    fun `текст отказа не показывает человеку код ответа`() {
        assertTrue(blockSaveErrorMessage(null).contains("подключение"))
        for (code in listOf(400, 401, 500)) {
            val message = blockSaveErrorMessage(failure<Unit>(code))
            assertFalse(message.contains(code.toString()))
        }
    }

    // ── Тело запроса ──

    @Test
    fun `тело запроса собирается одной функцией — той же, что зовёт ViewModel`() {
        val request = blockRequest(LocalDate.of(2026, 11, 17), " 14:00 ", " 17:00 ", "  Врач  ")

        assertEquals(
            CreateBlockRequest(
                startDate = "2026-11-17",
                endDate = "2026-11-17",
                startTime = "14:00",
                endTime = "17:00",
                type = "personal",
                reason = "Врач",
                cancelIntersectingSessions = false,
            ),
            request,
        )
    }
}
