package ru.cmpas.app.presentation.util

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import ru.cmpas.app.domain.model.Session
import ru.cmpas.app.domain.model.SessionFormat
import ru.cmpas.app.domain.model.SessionStatus
import java.io.File
import java.time.LocalDate

/**
 * Прошедшей встрече не предлагают подключиться, перенести и отменить.
 *
 * Живой случай 10.09.2026: учредитель отметил встречу как состоявшуюся и
 * увидел под ней ровно эти три кнопки. Причина — в панели не было НИ ОДНОГО
 * условия.
 *
 * Правило задал он же: «Если сессия закончилась, то зачем подключаться? Я уже
 * отметил, что сессия Была — ЕСЛИ НЕ БЫЛА, ТО ДРУГОЕ ДЕЛО». То есть дверь
 * закрывает не время, а названный исход.
 *
 * Набор случаев здесь тот же, что в tests/session-actions.test.ts: веб и
 * телефон обязаны отвечать одинаково, и расхождение опасно тем, что не падает
 * — просто в одном месте кнопка есть, а в другом нет.
 */
class SessionActionsTest {

    private val today: LocalDate = LocalDate.of(2026, 9, 10)

    private fun session(
        date: LocalDate = today,
        status: SessionStatus = SessionStatus.CONFIRMED,
        outcomeRecordedAt: String? = null,
        format: SessionFormat = SessionFormat.ONLINE,
    ) = Session(
        id = "s1",
        date = date.toString(),
        startTime = "13:00",
        status = status,
        format = format,
        outcomeRecordedAt = outcomeRecordedAt,
    )

    @Test
    fun `completed без отметки времени — догадка сервера, а не слово специалиста`() {
        // settlePastSessionsForPsychologist ставит completed через 15 минут
        // после конца встречи.
        assertFalse(isSessionSettled(SessionStatus.COMPLETED, null))
    }

    @Test
    fun `no_show сервер не ставит никогда — это всегда сказанное слово`() {
        assertTrue(isSessionSettled(SessionStatus.NO_SHOW, null))
    }

    @Test
    fun `отмеченной встрече не предлагают подключиться, перенести и отменить`() {
        val actions = sessionActions(session(outcomeRecordedAt = "2026-09-10T14:00:00Z"), today)

        assertFalse(actions.contains(SessionAction.CONNECT))
        assertFalse(actions.contains(SessionAction.RESCHEDULE))
        assertFalse(actions.contains(SessionAction.CANCEL))
        assertEquals(SessionAction.REBOOK, actions.first())
    }

    @Test
    fun `сегодняшняя, но ещё не отмеченная — весь набор остаётся`() {
        // «Если не была, то другое дело»: час прошёл, но ответа не было. Люди
        // опаздывают, и встреча в 13:00 вполне может начаться в 13:20.
        val actions = sessionActions(session(status = SessionStatus.COMPLETED), today)

        assertTrue(actions.contains(SessionAction.CONNECT))
        assertTrue(actions.contains(SessionAction.RESCHEDULE))
        assertTrue(actions.contains(SessionAction.CANCEL))
    }

    @Test
    fun `вчерашняя без отметки — подключаться уже не к чему`() {
        val actions = sessionActions(session(date = today.minusDays(1)), today)
        assertFalse(actions.contains(SessionAction.CONNECT))
    }

    @Test
    fun `очной встрече подключаться некуда`() {
        val actions = sessionActions(session(date = today.plusDays(1), format = SessionFormat.IN_PERSON), today)
        assertFalse(actions.contains(SessionAction.CONNECT))
        assertTrue(actions.contains(SessionAction.RESCHEDULE))
    }

    @Test
    fun `отменённой встречи больше нет — ни переноса, ни оплаты`() {
        val actions = sessionActions(session(date = today.plusDays(1), status = SessionStatus.CANCELLED), today)
        assertEquals(listOf(SessionAction.REBOOK, SessionAction.MESSAGE), actions)
    }

    @Test
    fun `панель экрана встречи спрашивает это правило, а не рисует кнопки безусловно`() {
        val screen = File("src/main/java/ru/cmpas/app/presentation/session/SessionDetailScreen.kt").readText()
        assertTrue(screen.contains("sessionActions(session)"))
        // Оплата называет действие, пока оно возможно.
        assertTrue(screen.contains("\"Отметить оплату\""))
    }
}
