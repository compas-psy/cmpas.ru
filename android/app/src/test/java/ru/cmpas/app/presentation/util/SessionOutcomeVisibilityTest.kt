package ru.cmpas.app.presentation.util

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import ru.cmpas.app.domain.model.SessionStatus
import java.time.LocalDate

/**
 * Условие видимости кнопок «Была»/«Не пришли» на экране деталей сессии и в
 * «сегодняшнем списке» дашборда — оба места делят один и тот же
 * canRecordSessionOutcome(), проверяется здесь один раз как чистая функция.
 */
class SessionOutcomeVisibilityTest {

    private val today = LocalDate.of(2026, 8, 29)

    @Test
    fun `сегодняшняя CONFIRMED сессия — кнопки видимы`() {
        assertTrue(canRecordSessionOutcome("2026-08-29", SessionStatus.CONFIRMED, today))
    }

    @Test
    fun `сегодняшняя COMPLETED сессия — кнопки видимы (сервер уже перевёл статус сам)`() {
        // Это и есть тот самый вечерний сценарий: settlePastSessionsForPsychologist
        // на сервере уже перевёл прошедший CONFIRMED в COMPLETED к моменту, когда
        // специалист открыл список. Без COMPLETED в множестве кнопки были бы
        // не видны почти всегда, когда специалист реально смотрит список.
        assertTrue(canRecordSessionOutcome("2026-08-29", SessionStatus.COMPLETED, today))
    }

    @Test
    fun `сегодняшняя PENDING сессия — кнопки видимы`() {
        assertTrue(canRecordSessionOutcome("2026-08-29", SessionStatus.PENDING, today))
    }

    @Test
    fun `прошедшая CONFIRMED сессия — кнопки видимы (можно назвать исход задним числом)`() {
        assertTrue(canRecordSessionOutcome("2026-08-20", SessionStatus.CONFIRMED, today))
    }

    @Test
    fun `будущая сессия — кнопки не видны, даже если статус CONFIRMED`() {
        assertFalse(canRecordSessionOutcome("2026-08-30", SessionStatus.CONFIRMED, today))
    }

    @Test
    fun `NO_SHOW — решение уже названо, кнопки не видны`() {
        assertFalse(canRecordSessionOutcome("2026-08-29", SessionStatus.NO_SHOW, today))
    }

    @Test
    fun `CANCELLED — сессии не было, кнопки не видны`() {
        assertFalse(canRecordSessionOutcome("2026-08-29", SessionStatus.CANCELLED, today))
    }

    @Test
    fun `нечитаемая дата — кнопки не видны`() {
        assertFalse(canRecordSessionOutcome("не дата", SessionStatus.CONFIRMED, today))
    }
}
