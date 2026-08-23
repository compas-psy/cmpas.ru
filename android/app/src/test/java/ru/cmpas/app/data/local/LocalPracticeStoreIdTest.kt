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
 * Молчаливая потеря работы пользователя: локальные записи затирали друг друга.
 *
 * Локальные записи получали id вида "local-session-${System.currentTimeMillis()}",
 * а запись в хранилище делается как `getSessions().filterNot { it.id == it2.id } + item`
 * — то есть совпадение id не создаёт дубль, а УДАЛЯЕТ предыдущую запись.
 * QuickActionViewModel.saveRepeatedSlot() вызывает createSession() в тесном
 * цикле repeat(count), и при попадании двух итераций в одну миллисекунду
 * повтор пропадал — при том, что пользователю сообщалось «Создано повторов: N».
 *
 * Сколько именно записей терялось на реальном устройстве — не измерено и здесь
 * не утверждается: это зависит от скорости записи в SharedPreferences. Тест
 * проверяет не частоту, а само правило, и потому замораживает часы.
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
        // Часы заморожены намеренно. Первая версия этого теста полагалась на
        // то, что цикл уложится в одну миллисекунду — на быстрой JVM он
        // укладывается, а в CI через Robolectric каждая итерация занимает
        // больше, и тест прошёл ЗЕЛЁНЫМ на несломанном коде, то есть проверял
        // скорость машины, а не правило. С замороженными часами проверяется
        // само правило: id локальной записи не имеет права зависеть от времени.
        store.clock = { 1_700_000_000_000L }
    }

    /** Ровно то, что делает saveRepeatedSlot: 12 записей в одну миллисекунду. */
    @Test
    fun `двенадцать повторов в одну миллисекунду создают двенадцать записей`() {
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
