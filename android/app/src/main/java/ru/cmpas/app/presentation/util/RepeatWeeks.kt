package ru.cmpas.app.presentation.util

import ru.cmpas.app.domain.model.Session
import ru.cmpas.app.domain.model.SessionStatus
import java.time.LocalDate
import java.time.LocalDateTime

/**
 * ПОВТОРНАЯ ЗАПИСЬ: «через неделю» и «на срок» — одно и то же с разным числом.
 *
 * Четыре кнопки были не границей здравого смысла, а границей интерфейса.
 * Учредитель 10.09.2026: «по неделям нужно более гибко, например, 4, 8, 12,
 * предложить своё». «До Нового года» и «до отпуска» в три числа не
 * укладываются, а специалист, которому не дали задать свой срок, доводит
 * остаток руками — ровно то, от чего это действие и избавляет.
 *
 * Числа те же, что на сервере (src/lib/practice/booking/repeat-slot-limits.ts).
 * Разойтись им нельзя: сервер обрежет молча, и человек получит не тот срок,
 * который назвал.
 */

/** Максимум за один заход — полгода. Не «сколько угодно»: каждая неделя это настоящая встреча. */
const val MAX_REPEAT_WEEKS = 26

/** Подсказки, а не весь выбор: рядом всегда поле для своего числа. */
val REPEAT_WEEK_PRESETS: List<Pair<Int, String>> = listOf(
    1 to "Через неделю",
    4 to "4 недели",
    8 to "8 недель",
    12 to "12 недель",
)

/** Свой срок принимается, только если он число и в границах. */
fun parseOwnWeeks(raw: String): Int? {
    val weeks = raw.trim().toIntOrNull() ?: return null
    return if (weeks in 1..MAX_REPEAT_WEEKS) weeks else null
}

/**
 * Опорная встреча — та, из которой берётся «тот же час».
 *
 * Правило то же, что на сервере (repeat-slot.ts): ближайшая будущая, иначе
 * последняя прошедшая. Отменённые не в счёт — их час освобождён.
 */
fun repeatReferenceSession(sessions: List<Session>): Session? {
    val alive = sessions.filter { it.status != SessionStatus.CANCELLED }
    if (alive.isEmpty()) return null
    val upcoming = alive
        .filter { session ->
            val moment = runCatching { LocalDateTime.parse("${session.date}T${session.startTime}") }.getOrNull()
            moment?.isAfter(LocalDateTime.now()) ?: runCatching { LocalDate.parse(session.date) >= LocalDate.now() }.getOrDefault(false)
        }
        .minByOrNull { "${it.date}T${it.startTime}" }
    return upcoming ?: alive.maxByOrNull { "${it.date}T${it.startTime}" }
}

/** Дата через N недель от опорной — для подписи «Среда, 17 сентября». */
fun weeksAfter(date: String, weeks: Int): LocalDate? =
    runCatching { LocalDate.parse(date).plusWeeks(weeks.toLong()) }.getOrNull()
