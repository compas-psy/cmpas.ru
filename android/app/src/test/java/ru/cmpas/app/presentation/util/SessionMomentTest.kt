package ru.cmpas.app.presentation.util

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test
import java.time.LocalDateTime

/**
 * Подпись отсчёта на карточке «Следующая сессия».
 *
 * Заведено по живому случаю 07.09.2026: у сессии в среду 20:00 карточка в
 * понедельник 18:11 писала «через 1 ч». Отсчёт считался по одному времени
 * суток — 18:11 → 20:00 = 109 минут, — а дата в вычисление не попадала.
 * Специалист прочитал это как «через час», и это была неправда о его
 * собственном расписании.
 *
 * Первая проверка здесь — ровно тот случай.
 */
class SessionMomentTest {

    /** Понедельник, 7 сентября 2026, 18:11 — время со скриншота. */
    private val mondayEvening = LocalDateTime.of(2026, 9, 7, 18, 11)

    @Test
    fun `сессия через два дня — называется днём, а не остатком`() {
        assertEquals(
            "в среду, 20:00",
            SessionMoment.untilLabel("2026-09-09", "20:00", mondayEvening),
        )
    }

    @Test
    fun `сессия сегодня — остаток с минутами, а не только часы`() {
        // 18:11 → 20:00 сегодня: 1 ч 49 мин. «через 1 ч» — та же ложь,
        // только мельче: целочисленное деление отбрасывало 49 минут.
        assertEquals(
            "через 1 ч 49 мин",
            SessionMoment.untilLabel("2026-09-07", "20:00", mondayEvening),
        )
    }

    @Test
    fun `меньше часа — в минутах`() {
        assertEquals("через 34 мин", SessionMoment.untilLabel("2026-09-07", "18:45", mondayEvening))
    }

    @Test
    fun `ровный час — без минут`() {
        assertEquals("через 2 ч", SessionMoment.untilLabel("2026-09-07", "20:11", mondayEvening))
    }

    @Test
    fun `завтра — так и говорится`() {
        assertEquals("завтра, 09:00", SessionMoment.untilLabel("2026-09-08", "09:00", mondayEvening))
    }

    // До правки этот случай не просто ошибался, а МОЛЧАЛ: разница по времени
    // суток отрицательная (09:00 против 18:11), функция возвращала null, и
    // подписи не было вовсе. Один дефект давал то фантомный отсчёт, то
    // пропавший.
    @Test
    fun `завтра утром — подпись есть, хотя по времени суток это прошлое`() {
        assertEquals("завтра, 09:00", SessionMoment.untilLabel("2026-09-08", "09:00", mondayEvening))
    }

    @Test
    fun `дальше недели — датой`() {
        assertEquals("20 сентября, 20:00", SessionMoment.untilLabel("2026-09-20", "20:00", mondayEvening))
    }

    @Test
    fun `прошедшая сессия — подписи нет`() {
        assertNull(SessionMoment.untilLabel("2026-09-07", "10:00", mondayEvening))
        assertNull(SessionMoment.untilLabel("2026-09-01", "20:00", mondayEvening))
    }

    @Test
    fun `нечитаемые строки не роняют экран`() {
        assertNull(SessionMoment.untilLabel("", "20:00", mondayEvening))
        assertNull(SessionMoment.untilLabel("2026-09-09", "", mondayEvening))
        assertNull(SessionMoment.startAt("не дата", "20:00"))
    }
}
