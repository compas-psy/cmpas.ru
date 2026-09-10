package ru.cmpas.app.presentation.util

import ru.cmpas.app.domain.model.Session
import ru.cmpas.app.domain.model.SessionStatus
import java.time.LocalDate

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
 *
 * ГРАНИЦА «БУДУЩЕГО» — ДЕНЬ, А НЕ МИНУТА, и это не мелочь. Сервер отбирает
 * `date >= начало сегодняшнего дня`, то есть СЕГОДНЯШНЯЯ встреча остаётся
 * опорной весь день, даже когда её час уже прошёл. Приложение до 10.09.2026
 * сравнивало дату вместе со временем и потому сегодняшнюю прошедшую встречу
 * отбрасывало.
 *
 * Расхождение видел человек: 10 сентября в карточке стояла встреча в 13:00,
 * уже прошедшая, и следующая — 11 сентября в 14:00. Экран обещал «пятница,
 * 18 сентября, 14:00», а сервер занял 17 и 24 сентября в 13:00, потому что
 * опорной для него была сегодняшняя. Уведомление клиенту ушло на настоящую
 * дату — то есть не на ту, которую специалист видел, когда нажимал.
 *
 * Поэтому здесь буквально серверное правило. И поэтому же экран после ответа
 * показывает даты, которые ВЕРНУЛ сервер, а не свою догадку: совпадение
 * правил можно снова потерять, а показ фактического ответа — нет.
 */
fun repeatReferenceSession(sessions: List<Session>, today: LocalDate = LocalDate.now()): Session? {
    val alive = sessions.filter { it.status != SessionStatus.CANCELLED }
    if (alive.isEmpty()) return null
    // Тот же порядок, что у сервера: по дате, затем по времени.
    val order = compareBy<Session>({ it.date }, { it.startTime })
    val upcoming = alive
        .filter { session ->
            val day = runCatching { LocalDate.parse(session.date) }.getOrNull()
            day != null && !day.isBefore(today)
        }
        .minWithOrNull(order)
    return upcoming ?: alive.maxWithOrNull(order)
}

/** Дата через N недель от опорной — для подписи «Среда, 17 сентября». */
fun weeksAfter(date: String, weeks: Int): LocalDate? =
    runCatching { LocalDate.parse(date).plusWeeks(weeks.toLong()) }.getOrNull()
