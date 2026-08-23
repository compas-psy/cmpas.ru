package ru.cmpas.app.data.local

import androidx.test.core.app.ApplicationProvider
import org.junit.Assert.assertEquals
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import ru.cmpas.app.domain.model.Client
import ru.cmpas.app.domain.model.ClientStatus
import ru.cmpas.app.domain.model.SessionFormat
import ru.cmpas.app.domain.model.SessionType
import java.time.LocalDate

/**
 * Замер молчаливой потери работы пользователя.
 *
 * Локальные записи получали id вида "local-session-${System.currentTimeMillis()}",
 * а запись в хранилище делалась как `getSessions().filterNot { it.id == session.id } + session`
 * — то есть совпадение id не создавало дубль, а УДАЛЯЛО предыдущую запись.
 * QuickActionViewModel.saveRepeatedSlot() вызывает createSession() в тесном
 * цикле repeat(count), весь цикл укладывается в одну миллисекунду, и из
 * двенадцати запрошенных повторов до хранилища доезжал один — при том, что
 * пользователю сообщалось «Создано повторов: 12».
 *
 * Тест намеренно гоняет НАСТОЯЩИЙ LocalPracticeStore на настоящем
 * SharedPreferences (Robolectric), а не переписанную копию его логики:
 * копия проверяет копию.
 */
@RunWith(RobolectricTestRunner::class)
class LocalPracticeStoreIdTest {

    private lateinit var store: LocalPracticeStore

    private val client = Client(
        id = "client-1",
        name = "Тестовый клиент",
        status = ClientStatus.ACTIVE,
    )

    @Before
    fun setUp() {
        store = LocalPracticeStore(ApplicationProvider.getApplicationContext())
    }

    /** Ровно то, что делает saveRepeatedSlot: 12 итераций подряд, без пауз. */
    @Test
    fun `двенадцать повторов подряд создают двенадцать записей`() {
        val date = LocalDate.parse("2026-09-01")
        repeat(12) { index ->
            store.createSession(
                client = client,
                date = date.plusWeeks(index.toLong()).toString(),
                startTime = "10:00",
                endTime = "10:50",
                format = SessionFormat.ONLINE,
                type = SessionType.INDIVIDUAL,
                notes = null,
            )
        }
        assertEquals(
            "повторы затирают друг друга: id не уникален в пределах миллисекунды",
            12,
            store.getSessions().size,
        )
    }

    @Test
    fun `id двенадцати повторов различны`() {
        val date = LocalDate.parse("2026-09-01")
        repeat(12) { index ->
            store.createSession(
                client = client,
                date = date.plusWeeks(index.toLong()).toString(),
                startTime = "10:00",
                endTime = "10:50",
                format = SessionFormat.ONLINE,
                type = SessionType.INDIVIDUAL,
                notes = null,
            )
        }
        val ids = store.getSessions().map { it.id }
        assertEquals("id повторов совпадают", ids.size, ids.toSet().size)
    }

    /** Тот же шаблон id живёт и у клиентов — цикла там нет, но дефект тот же. */
    @Test
    fun `подряд созданные клиенты не затирают друг друга`() {
        repeat(12) { index ->
            store.createClient("Клиент $index", null, null, null, null)
        }
        assertEquals(12, store.getClients().size)
        val ids = store.getClients().map { it.id }
        assertEquals("id клиентов совпадают", ids.size, ids.toSet().size)
    }

    /** У заметок дедупликация идёт по sessionId, но id обязан быть уникальным:
     *  на нём будет держаться ключ очереди досылки. */
    @Test
    fun `id подряд сохранённых заметок различны`() {
        val ids = (0 until 12).map { index ->
            store.saveNote(sessionId = "session-$index", text = "заметка $index").id
        }
        assertEquals("id заметок совпадают", ids.size, ids.toSet().size)
    }
}
