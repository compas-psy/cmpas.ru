package ru.cmpas.app.presentation.util

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import ru.cmpas.app.domain.model.Session
import ru.cmpas.app.domain.model.SessionStatus
import java.io.File
import java.time.LocalDate

/**
 * Повторная запись: срок задаётся числом, а не выбором из четырёх кнопок.
 *
 * Учредитель 10.09.2026: «по неделям нужно более гибко, например, 4, 8, 12,
 * предложить своё». Четыре кнопки были не границей здравого смысла, а
 * границей интерфейса: «до Нового года» и «до отпуска» в три числа не
 * укладываются, и специалист доводил остаток встреч руками.
 */
class RepeatWeeksTest {

    private fun session(date: String, time: String = "13:00", status: SessionStatus = SessionStatus.COMPLETED) =
        Session(id = "$date $time", date = date, startTime = time, status = status)

    // ── Свой срок ──

    @Test
    fun `свой срок принимается числом`() {
        assertEquals(17, parseOwnWeeks("17"))
        assertEquals(1, parseOwnWeeks(" 1 "))
    }

    @Test
    fun `подсказки не покрывают всех сроков — иначе поле было бы лишним`() {
        assertTrue(REPEAT_WEEK_PRESETS.none { it.first == 17 })
        assertNotNull(parseOwnWeeks("17"))
    }

    @Test
    fun `ноль, мусор и слишком долгий срок не принимаются`() {
        // Полгода — не «сколько угодно»: каждая неделя это настоящая встреча
        // в расписании, и занять год одним нажатием значит сделать ошибку, на
        // разбор которой уйдёт вечер.
        assertNull(parseOwnWeeks("0"))
        assertNull(parseOwnWeeks(""))
        assertNull(parseOwnWeeks("много"))
        assertNull(parseOwnWeeks("${MAX_REPEAT_WEEKS + 1}"))
        assertNotNull(parseOwnWeeks("$MAX_REPEAT_WEEKS"))
    }

    @Test
    fun `граница та же, что на сервере`() {
        // Разойтись им нельзя: сервер обрежет молча, и человек получит не тот
        // срок, который назвал.
        val server = File("../../src/lib/practice/booking/repeat-slot-limits.ts").readText()
        assertTrue(
            "MAX_REPEAT_WEEKS в Kotlin ($MAX_REPEAT_WEEKS) должен совпадать с сервером",
            server.contains("MAX_REPEAT_WEEKS = $MAX_REPEAT_WEEKS"),
        )
    }

    // ── Опорная встреча ──

    @Test
    fun `опорная — ближайшая будущая`() {
        val future = LocalDate.now().plusDays(3).toString()
        val past = LocalDate.now().minusDays(7).toString()

        assertEquals(future, repeatReferenceSession(listOf(session(past), session(future)))?.date)
    }

    @Test
    fun `впереди пусто — берётся последняя прошедшая`() {
        val older = LocalDate.now().minusDays(14).toString()
        val newer = LocalDate.now().minusDays(7).toString()

        assertEquals(newer, repeatReferenceSession(listOf(session(older), session(newer)))?.date)
    }

    @Test
    fun `отменённые не в счёт — их час освобождён`() {
        val cancelled = LocalDate.now().plusDays(2).toString()
        val real = LocalDate.now().minusDays(2).toString()

        val reference = repeatReferenceSession(listOf(
            session(cancelled, status = SessionStatus.CANCELLED),
            session(real),
        ))

        assertEquals(real, reference?.date)
    }

    @Test
    fun `сегодняшняя встреча остаётся опорной весь день, даже когда её час прошёл`() {
        // Так отбирает сервер: date >= начало сегодняшнего дня. Приложение
        // сравнивало дату вместе со временем и сегодняшнюю прошедшую встречу
        // отбрасывало — и обещало человеку не тот день и не тот час, на
        // которые запись потом происходила.
        val today = LocalDate.now().toString()
        val tomorrow = LocalDate.now().plusDays(1).toString()

        val reference = repeatReferenceSession(listOf(
            session(tomorrow, time = "14:00"),
            session(today, time = "00:01"),
        ))

        assertEquals(today, reference?.date)
        assertEquals("00:01", reference?.startTime)
    }

    @Test
    fun `в один день опорная — та, что раньше по времени`() {
        // Порядок тот же, что у сервера: по дате, затем по времени.
        val day = LocalDate.now().plusDays(2).toString()

        val reference = repeatReferenceSession(listOf(session(day, time = "18:00"), session(day, time = "11:00")))

        assertEquals("11:00", reference?.startTime)
    }

    @Test
    fun `правило опорной встречи то же, что на сервере`() {
        // Сервер: date >= todayStart, порядок [date asc, time asc]; если
        // впереди пусто — последняя по [date desc, time desc]. Расхождение
        // здесь человек видит не в интерфейсе, а в уведомлении клиенту.
        val server = File("../../src/lib/practice/booking/repeat-slot.ts").readText()
        assertTrue(
            "сервер должен отбирать будущее по НАЧАЛУ ДНЯ, а не по моменту",
            server.contains("date: { gte: todayStart }"),
        )
        assertTrue(server.contains("orderBy: [{ date: 'asc' }, { time: 'asc' }]"))
        assertTrue(server.contains("orderBy: [{ date: 'desc' }, { time: 'desc' }]"))
    }

    @Test
    fun `ответ сервера замещает форму, а не дописывается под ней`() {
        // Учредитель 10.09.2026: «после нажатия на кнопку интерфейс не
        // меняется — должно исчезнуть поле и кнопка и написаться "Записаны на
        // N недель вперёд"». Клавиатура закрывала низ экрана, где лежал ответ.
        val screen = File("src/main/java/ru/cmpas/app/presentation/rebook/RebookScreen.kt").readText()
        assertTrue("итог должен быть отдельным состоянием экрана", screen.contains("if (uiState.hasResult)"))
        assertTrue(screen.contains("Записаны на "))
        // Даты в итоге — те, что вернул сервер, а не собственная догадка.
        assertTrue(screen.contains("uiState.booked.forEach"))
        assertTrue(screen.contains("uiState.serverReference"))
    }

    @Test
    fun `в заголовке не написано «был», когда встреча ещё впереди`() {
        val screen = File("src/main/java/ru/cmpas/app/presentation/rebook/RebookScreen.kt").readText()
        assertTrue(screen.contains("referenceTense(reference.date)"))
        assertTrue("прошлое и будущее должны называться по-разному", screen.contains("\"записан\""))
    }

    @Test
    fun `число недель склоняется`() {
        val screen = File("src/main/java/ru/cmpas/app/presentation/rebook/RebookScreen.kt").readText()
        for (form in listOf("неделю", "недели", "недель")) {
            assertTrue("«Записаны на N ...» должно склоняться: $form", screen.contains("\"$form\""))
        }
    }

    @Test
    fun `встреч не было — повторять нечего`() {
        assertNull(repeatReferenceSession(emptyList()))
    }

    @Test
    fun `дата через неделю — тот же день недели`() {
        val next = weeksAfter("2026-09-10", 1)
        assertEquals(LocalDate.parse("2026-09-17"), next)
        assertEquals(LocalDate.parse("2026-09-10").dayOfWeek, next?.dayOfWeek)
    }

    // ── Развилка есть там, где о ней думают ──

    @Test
    fun `«Записать снова» ведёт на развилку, а не в общий календарь`() {
        // Ядро повторной записи было написано и работало — но вызывалось
        // только из карточки клиента, куда после встречи никто не заходит.
        val nav = File("src/main/java/ru/cmpas/app/presentation/navigation/CompasNavHost.kt").readText()
        assertTrue(nav.contains("Screen.Rebook.createRoute"))

        val screen = File("src/main/java/ru/cmpas/app/presentation/rebook/RebookScreen.kt").readText()
        for (option in listOf("Тот же час через неделю", "Тот же час на срок", "Выбрать другое время")) {
            assertTrue("на развилке должен быть вариант «$option»", screen.contains(option))
        }
    }
}
