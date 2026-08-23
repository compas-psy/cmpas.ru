package ru.cmpas.app.data.local

import androidx.test.core.app.ApplicationProvider
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import ru.cmpas.app.domain.model.SessionFormat
import ru.cmpas.app.domain.model.SessionType

/**
 * Очередь досылки: четыре правила, без которых она не работает.
 *
 * Проверяется настоящий LocalPracticeStore на настоящем SharedPreferences.
 * Сеть здесь не участвует намеренно: предмет проверки — порядок зависимостей,
 * переназначение идентификаторов и разбор накопленного, а не поведение
 * сервера. Идемпотентность на стороне сервера проверяется отдельно, против
 * настоящего маршрута (tests/mobile-idempotency.test.ts).
 */
@RunWith(RobolectricTestRunner::class)
class OutboxQueueTest {

    private lateinit var store: LocalPracticeStore

    @Before
    fun setUp() {
        store = LocalPracticeStore(ApplicationProvider.getApplicationContext())
    }

    private fun localClient(name: String = "Клиент") =
        store.createClient(name, null, null, null, null)

    // ── (б) идемпотентность ─────────────────────────────────────────────

    @Test
    fun `ключ идемпотентности рождается при постановке и не меняется при повторной постановке`() {
        val client = localClient()
        store.enqueue("client", client.id)
        val first = store.getOutbox().single().opId

        store.enqueue("client", client.id) // повторная постановка того же
        val entries = store.getOutbox()

        assertEquals("повторная постановка создала дубль", 1, entries.size)
        assertEquals("ключ подменился между попытками отправки", first, entries.single().opId)
    }

    @Test
    fun `у разных записей разные ключи`() {
        val a = localClient("А")
        val b = localClient("Б")
        store.enqueue("client", a.id)
        store.enqueue("client", b.id)
        val keys = store.getOutbox().map { it.opId }
        assertEquals("ключи совпали", keys.size, keys.toSet().size)
    }

    // ── (а) порядок зависимостей и переназначение id ────────────────────

    @Test
    fun `сессия локального клиента ждёт его создания`() {
        val client = localClient()
        val session = store.createSession(
            client = client,
            date = "2026-09-01",
            startTime = "10:00",
            endTime = "10:50",
            format = SessionFormat.ONLINE,
            type = SessionType.INDIVIDUAL,
            notes = null,
        )
        store.enqueueOrphans()

        val sessionEntry = store.getOutbox().first { it.localId == session.id }
        assertEquals(
            "сессия не знает, что ждёт клиента — уедет с несуществующим clientId",
            client.id,
            sessionEntry.dependsOnLocalId,
        )
    }

    @Test
    fun `после создания клиента на сервере зависимость снимается и ссылки переписываются`() {
        val client = localClient()
        val session = store.createSession(
            client = client,
            date = "2026-09-01",
            startTime = "10:00",
            endTime = "10:50",
            format = SessionFormat.ONLINE,
            type = SessionType.INDIVIDUAL,
            notes = null,
        )
        store.enqueueOrphans()

        store.remapClientId(client.id, "server-client-1")

        assertNull("карточка осталась под локальным id", store.clientById(client.id))
        assertNotNull("карточка не появилась под серверным id", store.clientById("server-client-1"))
        assertEquals(
            "сессия по-прежнему ссылается на несуществующего клиента",
            "server-client-1",
            store.sessionById(session.id)?.clientId,
        )
        assertNull(
            "зависимость не снята — сессия никогда не уедет",
            store.getOutbox().first { it.localId == session.id }.dependsOnLocalId,
        )
    }

    @Test
    fun `переназначение id сессии переносит и заметку`() {
        val client = localClient()
        val session = store.createSession(
            client = client,
            date = "2026-09-01",
            startTime = "10:00",
            endTime = "10:50",
            format = SessionFormat.ONLINE,
            type = SessionType.INDIVIDUAL,
            notes = null,
        )
        store.saveNote(session.id, "текст заметки")

        store.remapSessionId(session.id, "server-session-1")

        assertEquals(
            "заметка осталась привязана к локальной сессии и потеряется",
            "server-session-1",
            store.getNotes().single().sessionId,
        )
    }

    // ── (г) разбор накопленного ─────────────────────────────────────────

    @Test
    fun `уже осевшие записи попадают в очередь без новых действий пользователя`() {
        // Записи созданы ДО появления очереди — ровно то, что лежит на
        // телефонах сегодня. Без этого починка не вернула бы ничего.
        val client = localClient()
        store.createSession(
            client = client,
            date = "2026-09-01",
            startTime = "10:00",
            endTime = "10:50",
            format = SessionFormat.ONLINE,
            type = SessionType.INDIVIDUAL,
            notes = null,
        )
        assertEquals("очередь не была пуста до разбора", 0, store.pendingCount())

        store.enqueueOrphans()

        assertEquals("накопленное не подхвачено", 2, store.pendingCount())
        assertTrue(store.getOutbox().any { it.kind == "client" })
        assertTrue(store.getOutbox().any { it.kind == "session" })
    }

    @Test
    fun `повторный разбор не плодит записи`() {
        localClient()
        store.enqueueOrphans()
        store.enqueueOrphans()
        store.enqueueOrphans()
        assertEquals(1, store.pendingCount())
    }

    // ── (в) видимость ───────────────────────────────────────────────────

    @Test
    fun `счётчик недоставленного уменьшается только по подтверждению`() {
        val client = localClient()
        store.enqueue("client", client.id)
        assertEquals(1, store.pendingCount())

        store.markOutboxFailure(client.id, "HTTP 500")
        assertEquals("отказ убрал запись из очереди — это потеря", 1, store.pendingCount())
        assertEquals(1, store.getOutbox().single().attempts)

        store.removeFromOutbox(client.id)
        assertEquals(0, store.pendingCount())
    }
}
