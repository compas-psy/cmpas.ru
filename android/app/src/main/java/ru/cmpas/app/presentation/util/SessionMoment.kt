package ru.cmpas.app.presentation.util

import java.time.DayOfWeek
import java.time.Duration
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.LocalTime
import java.time.format.DateTimeFormatter
import java.util.Locale

/**
 * Момент начала сессии: дата и время вместе.
 *
 * Заведено потому, что от базы до экрана `date` и `startTime` живут двумя
 * несвязанными строками, и каждый экран склеивал их (или не склеивал) сам.
 * 07.09.2026 это дало на дашборде подпись «через 1 ч» у сессии, до которой
 * оставалось двое суток: отсчёт считался по одному времени суток —
 * 18:11 → 20:00 = 109 минут, — а дата в вычисление не попадала вовсе.
 *
 * Компилятор такому не мешает: обе строки одного типа, и передать в
 * подсчёт остатка одно время без даты можно молча. Единственная защита —
 * общее место, где момент собирается целиком.
 */
object SessionMoment {

    /** Склеить дату и время в один момент. null — если строки нечитаемы. */
    fun startAt(date: String, time: String): LocalDateTime? = try {
        LocalDateTime.of(LocalDate.parse(date), LocalTime.parse(time))
    } catch (_: Exception) {
        null
    }

    /**
     * Сколько осталось до сессии — словами, которые не врут.
     *
     * До этого подпись знала только «через N ч» и потому обязана была
     * лгать про всё, что дальше сегодняшнего дня. Теперь ближнее время
     * называется остатком, дальнее — днём: «завтра, 20:00», «в среду,
     * 20:00», «9 сентября, 20:00».
     *
     * Прошедшее и текущее — null: подписи нет, как и было.
     */
    fun untilLabel(date: String, time: String, now: LocalDateTime = LocalDateTime.now()): String? {
        val start = startAt(date, time) ?: return null
        if (!start.isAfter(now)) return null

        val minutes = Duration.between(now, start).toMinutes()
        val today = now.toLocalDate()
        val day = start.toLocalDate()

        return when {
            // Сегодня — считаем остаток. Минуты не отбрасываем: «через 1 ч»
            // при остатке 1 ч 49 мин — та же ложь, только мельче.
            day == today && minutes < 60 -> "через $minutes мин"
            day == today && minutes % 60 == 0L -> "через ${minutes / 60} ч"
            day == today -> "через ${minutes / 60} ч ${minutes % 60} мин"

            day == today.plusDays(1) -> "завтра, $time"

            // Ближайшая неделя — по дню недели: так специалист узнаёт день,
            // не считая даты в уме.
            day.isBefore(today.plusDays(7)) -> "${inDay(day.dayOfWeek)}, $time"

            else -> "${day.format(DAY_MONTH)}, $time"
        }
    }

    private val DAY_MONTH = DateTimeFormatter.ofPattern("d MMMM", Locale("ru"))

    /** «в среду», но «во вторник» — предлог зависит от слова. */
    private fun inDay(day: DayOfWeek): String = when (day) {
        DayOfWeek.MONDAY -> "в понедельник"
        DayOfWeek.TUESDAY -> "во вторник"
        DayOfWeek.WEDNESDAY -> "в среду"
        DayOfWeek.THURSDAY -> "в четверг"
        DayOfWeek.FRIDAY -> "в пятницу"
        DayOfWeek.SATURDAY -> "в субботу"
        DayOfWeek.SUNDAY -> "в воскресенье"
    }
}
