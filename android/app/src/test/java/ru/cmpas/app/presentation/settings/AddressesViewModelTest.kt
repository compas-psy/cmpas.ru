package ru.cmpas.app.presentation.settings

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.ResponseBody.Companion.toResponseBody
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import retrofit2.Response
import ru.cmpas.app.data.api.FakeCompasApi
import ru.cmpas.app.domain.model.CreatePracticeAddressRequest
import ru.cmpas.app.domain.model.PracticeAddress
import ru.cmpas.app.domain.model.PracticeAddressList
import ru.cmpas.app.domain.model.UpdatePracticeAddressRequest

/**
 * Приёмка Задачи 21 по кабинетам в приложении.
 *
 * Проверяется одно сквозное правило и его следствия: список кабинетов на
 * экране меняется ТОЛЬКО из успешного ответа сервера.
 *
 * Самое важное здесь — поведение при 409 ADDRESS_IN_USE. Соблазн убрать
 * карточку сразу, «оптимистично», выглядит отзывчивее, но кабинет при этом
 * остаётся в работе: экран показывал бы одно, сервер знал другое, а
 * специалист узнал бы правду в тот момент, когда клиент придёт по старому
 * адресу.
 */
class AddressesViewModelTest {

    @Before
    fun setUp() {
        Dispatchers.setMain(UnconfinedTestDispatcher())
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    private val yauzskaya = PracticeAddress("a-1", "Яузская", "Москва, Яузская ул., 8с2", isPrimary = true)
    private val kurkino = PracticeAddress("a-2", "Куркино", "Москва, Соловьиная роща, 1", isPrimary = false)

    private fun listOfBoth() = PracticeAddressList(listOf(yauzskaya, kurkino))

    private fun <T> failure(code: Int): Response<T> =
        Response.error(code, "".toResponseBody("application/json".toMediaType()))

    /** Двойник, отвечающий на кабинетные вызовы; остальные так и остаются «не переопределён». */
    private class AddressApi(
        val onList: suspend () -> Response<PracticeAddressList>,
        val onCreate: suspend (CreatePracticeAddressRequest) -> Response<PracticeAddress> = { error("createAddress не ожидался") },
        val onUpdate: suspend (String, UpdatePracticeAddressRequest) -> Response<PracticeAddressList> = { _, _ -> error("updateAddress не ожидался") },
        val onDelete: suspend (String) -> Response<PracticeAddressList> = { error("deactivateAddress не ожидался") },
    ) : FakeCompasApi() {
        override suspend fun getAddresses() = onList()
        override suspend fun createAddress(body: CreatePracticeAddressRequest) = onCreate(body)
        override suspend fun updateAddress(id: String, body: UpdatePracticeAddressRequest) = onUpdate(id, body)
        override suspend fun deactivateAddress(id: String) = onDelete(id)
    }

    @Test
    fun `список загружается с сервера`() = runTest {
        val viewModel = AddressesViewModel(AddressApi(onList = { Response.success(listOfBoth()) }))

        val state = viewModel.uiState.value
        assertEquals(listOf("a-1", "a-2"), state.addresses.map { it.id })
        assertEquals("Москва, Яузская ул., 8с2", state.addresses.first().address)
        assertNull(state.loadError)
    }

    @Test
    fun `сервер не ответил — экран говорит об этом, а не показывает пустую практику`() = runTest {
        val viewModel = AddressesViewModel(AddressApi(onList = { failure(500) }))

        val state = viewModel.uiState.value
        assertTrue(state.addresses.isEmpty())
        assertNotNull(state.loadError)
    }

    @Test
    fun `создание кабинета обновляет список`() = runTest {
        var created: CreatePracticeAddressRequest? = null
        var listCalls = 0
        val added = PracticeAddress("a-3", "Покровка", "Москва, Покровка, 3")
        val viewModel = AddressesViewModel(AddressApi(
            onList = {
                listCalls++
                if (listCalls == 1) Response.success(listOfBoth())
                else Response.success(PracticeAddressList(listOf(yauzskaya, kurkino, added)))
            },
            onCreate = { body -> created = body; Response.success(added) },
        ))

        viewModel.create("Покровка", "Москва, Покровка, 3")

        assertEquals(CreatePracticeAddressRequest("Покровка", "Москва, Покровка, 3"), created)
        assertEquals(listOf("a-1", "a-2", "a-3"), viewModel.uiState.value.addresses.map { it.id })
    }

    @Test
    fun `адрес вводится вручную и сохраняется как есть — подсказки не нужны`() = runTest {
        var created: CreatePracticeAddressRequest? = null
        val handwritten = "деревня Клюквино, у почты"
        val viewModel = AddressesViewModel(AddressApi(
            onList = { Response.success(PracticeAddressList(emptyList())) },
            onCreate = { body -> created = body; Response.success(PracticeAddress("a-9", "Дом", handwritten)) },
        ))

        viewModel.create("  Дом  ", "  $handwritten  ")

        // Лишние пробелы срезаны, сам адрес не нормализован и не подменён.
        assertEquals(CreatePracticeAddressRequest("Дом", handwritten), created)
    }

    @Test
    fun `пустое название или адрес до сервера не доходят`() = runTest {
        val viewModel = AddressesViewModel(AddressApi(onList = { Response.success(listOfBoth()) }))

        viewModel.create("Кабинет", "   ")

        assertNotNull(viewModel.uiState.value.actionError)
        assertEquals(listOf("a-1", "a-2"), viewModel.uiState.value.addresses.map { it.id })
    }

    @Test
    fun `редактирование обновляет список тем, что вернул сервер`() = runTest {
        var patched: Pair<String, UpdatePracticeAddressRequest>? = null
        val renamed = kurkino.copy(name = "Куркино, каб. 4")
        val viewModel = AddressesViewModel(AddressApi(
            onList = { Response.success(listOfBoth()) },
            onUpdate = { id, body ->
                patched = id to body
                Response.success(PracticeAddressList(listOf(yauzskaya, renamed)))
            },
        ))

        viewModel.rename("a-2", "Куркино, каб. 4", kurkino.address)

        assertEquals("a-2", patched?.first)
        assertEquals(UpdatePracticeAddressRequest(name = "Куркино, каб. 4", address = kurkino.address), patched?.second)
        assertEquals("Куркино, каб. 4", viewModel.uiState.value.addresses.first { it.id == "a-2" }.name)
    }

    @Test
    fun `сделать основным переносит метку, а не добавляет вторую`() = runTest {
        var patched: UpdatePracticeAddressRequest? = null
        val viewModel = AddressesViewModel(AddressApi(
            onList = { Response.success(listOfBoth()) },
            onUpdate = { _, body ->
                patched = body
                Response.success(PracticeAddressList(listOf(
                    yauzskaya.copy(isPrimary = false),
                    kurkino.copy(isPrimary = true),
                )))
            },
        ))

        viewModel.makePrimary("a-2")

        assertEquals(UpdatePracticeAddressRequest(isPrimary = true), patched)
        val primary = viewModel.uiState.value.addresses.filter { it.isPrimary }
        assertEquals(1, primary.size)
        assertEquals("a-2", primary.single().id)
    }

    @Test
    fun `успешный вывод из работы убирает кабинет из списка`() = runTest {
        var deleted: String? = null
        val viewModel = AddressesViewModel(AddressApi(
            onList = { Response.success(listOfBoth()) },
            onDelete = { id -> deleted = id; Response.success(PracticeAddressList(listOf(yauzskaya))) },
        ))

        viewModel.deactivate("a-2")

        assertEquals("a-2", deleted)
        assertEquals(listOf("a-1"), viewModel.uiState.value.addresses.map { it.id })
        assertNull(viewModel.uiState.value.actionError)
    }

    @Test
    fun `409 ADDRESS_IN_USE называет причину и НЕ убирает карточку`() = runTest {
        val viewModel = AddressesViewModel(AddressApi(
            onList = { Response.success(listOfBoth()) },
            onDelete = { failure(409) },
        ))

        viewModel.deactivate("a-1")

        // Кабинет остался в работе на сервере — значит остаётся и на экране.
        assertEquals(listOf("a-1", "a-2"), viewModel.uiState.value.addresses.map { it.id })
        assertEquals(
            "Этот кабинет используется в будущих записях или расписании. Сначала измените их, затем попробуйте снова.",
            viewModel.uiState.value.actionError,
        )
    }

    @Test
    fun `причина остаётся, пока её не закроют`() = runTest {
        val viewModel = AddressesViewModel(AddressApi(
            onList = { Response.success(listOfBoth()) },
            onDelete = { failure(409) },
        ))

        viewModel.deactivate("a-1")
        assertNotNull(viewModel.uiState.value.actionError)

        viewModel.dismissActionError()
        assertNull(viewModel.uiState.value.actionError)
    }

    @Test
    fun `отказ сервера при смене основного список не трогает`() = runTest {
        val viewModel = AddressesViewModel(AddressApi(
            onList = { Response.success(listOfBoth()) },
            onUpdate = { _, _ -> failure(404) },
        ))

        viewModel.makePrimary("a-2")

        assertEquals("a-1", viewModel.uiState.value.addresses.single { it.isPrimary }.id)
        assertNotNull(viewModel.uiState.value.actionError)
    }

    @Test
    fun `текст причины называет следующий шаг, а не код ответа`() {
        assertEquals(
            "Этот кабинет используется в будущих записях или расписании. Сначала измените их, затем попробуйте снова.",
            addressActionErrorMessage(409),
        )
        assertTrue(addressActionErrorMessage(400).contains("обязательны"))
        assertTrue(addressActionErrorMessage(500).contains("Попробуйте"))
        // Ни один текст не показывает человеку числовой код.
        for (code in listOf(400, 401, 404, 409, 500, 0)) {
            assertTrue(code.toString() !in addressActionErrorMessage(code))
        }
    }

    @Test
    fun `mergeAddresses оставляет прежний список, когда ответа нет или он неуспешен`() {
        val previous = listOf(yauzskaya)

        assertEquals(previous, mergeAddresses(null, previous))
        assertEquals(previous, mergeAddresses(failure(409), previous))
        assertEquals(
            listOf("a-1", "a-2"),
            mergeAddresses(Response.success(listOfBoth()), previous).map { it.id },
        )
    }
}
