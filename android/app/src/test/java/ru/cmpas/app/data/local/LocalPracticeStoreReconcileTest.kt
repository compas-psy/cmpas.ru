package ru.cmpas.app.data.local

import androidx.test.core.app.ApplicationProvider
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import ru.cmpas.app.domain.model.Client
import ru.cmpas.app.domain.model.ClientStatus

/**
 * Клиент, удалённый в вебе, оставался в приложении навсегда.
 *
 * Хранилище умело только добавлять и обновлять, а список на экране строится
 * склейкой «серверные + сохранённые». Склейка по определению не может убрать
 * то, чего в серверном ответе нет: карточка человека, которого в практике
 * больше нет, продолжала показываться и предлагаться при записи.
 *
 * Тест гоняет настоящий LocalPracticeStore на настоящем SharedPreferences
 * (Robolectric), а не копию его логики.
 */
@RunWith(RobolectricTestRunner::class)
class LocalPracticeStoreReconcileTest {

    private lateinit var store: LocalPracticeStore

    private fun client(id: String, name: String) =
        Client(id = id, name = name, status = ClientStatus.ACTIVE)

    @Before
    fun setUp() {
        store = LocalPracticeStore(ApplicationProvider.getApplicationContext())
    }

    @Test
    fun `клиента, которого сервер больше не отдаёт, в хранилище не остаётся`() {
        store.upsertClient(client("srv-1", "Останется"))
        store.upsertClient(client("srv-2", "Удалён в вебе"))

        val removed = store.reconcileClients(setOf("srv-1"))

        assertEquals(1, removed)
        assertEquals(listOf("srv-1"), store.getClients().map { it.id })
    }

    @Test
    fun `ещё не отправленный клиент не удаляется — его как раз ждёт очередь досылки`() {
        val local = store.createClient("Заведён без связи", null, null, null, null)
        store.upsertClient(client("srv-1", "С сервера"))

        // Сервер о локальной карточке не знает ПО ОПРЕДЕЛЕНИЮ: она ещё не
        // отправлена. Удалить её значило бы стереть работу специалиста и
        // выдать это за чужое удаление.
        store.reconcileClients(setOf("srv-1"))

        assertTrue(store.getClients().any { it.id == local.id })
        assertEquals(2, store.getClients().size)
    }

    @Test
    fun `пустой ответ сервера убирает всех серверных, но не локальных`() {
        store.upsertClient(client("srv-1", "Один"))
        store.upsertClient(client("srv-2", "Два"))
        val local = store.createClient("Свой", null, null, null, null)

        store.reconcileClients(emptySet())

        assertEquals(listOf(local.id), store.getClients().map { it.id })
    }

    @Test
    fun `когда удалять нечего, хранилище не переписывается`() {
        store.upsertClient(client("srv-1", "Один"))

        assertEquals(0, store.reconcileClients(setOf("srv-1", "srv-2")))
        assertEquals(1, store.getClients().size)
    }
}
