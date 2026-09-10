package ru.cmpas.app.presentation.util

import ru.cmpas.app.domain.model.SessionStatus
import java.time.LocalDate

/**
 * Статусы, для которых специалист ещё может назвать реальный исход сессии
 * («Была» / «Не пришли»).
 *
 * COMPLETED здесь неспроста рядом с PENDING/CONFIRMED: сервер сам переводит
 * CONFIRMED в COMPLETED через 15+ минут после начала сессии
 * (settlePastSessionsForPsychologist, src/lib/session-maintenance.ts — вызывается
 * мобильными /api/mobile/dashboard и /api/mobile/sessions при каждой загрузке).
 * Значит к вечеру, когда специалист обычно и просматривает список, почти все
 * сегодняшние сессии уже COMPLETED, а не CONFIRMED. Без COMPLETED в этом
 * множестве кнопка «Не пришли» была бы недоступна именно в том сценарии, ради
 * которого её просили. complete()/noShow() перезаписывают статус безусловно,
 * так что уточнить автоматически проставленный COMPLETED задним числом —
 * безопасно.
 *
 * NO_SHOW и CANCELLED сюда не входят: решение по ним уже названо явно, и эта
 * кнопка не предлагает его пересматривать.
 */
private val OUTCOME_EDITABLE_STATUSES = setOf(
    SessionStatus.PENDING,
    SessionStatus.CONFIRMED,
    SessionStatus.COMPLETED,
)

/**
 * Можно ли специалисту отметить исход сессии («Была» / «Не пришли») прямо со
 * списка или с экрана деталей, не открывая перенос/отмену.
 *
 * Сравнение — по дню, без времени: часовой пояс специалиста и его телефона
 * всегда совпадает, отдельная обработка времени суток не нужна. Сессия
 * сегодня вечером ещё не наступила, но она уже показана в «сегодня», и
 * специалист должен суметь пройти весь день одним проходом, не дожидаясь
 * полуночи, поэтому "сегодня" целиком, а не только "уже прошедшее время",
 * входит в условие.
 *
 * Нечитаемая/будущая дата или статус вне [OUTCOME_EDITABLE_STATUSES] —
 * кнопки не показываются, действует прежний пассивный чип со статусом.
 */
fun canRecordSessionOutcome(date: String, status: SessionStatus, today: LocalDate = LocalDate.now()): Boolean {
    if (status !in OUTCOME_EDITABLE_STATUSES) return false
    val sessionDate = runCatching { LocalDate.parse(date) }.getOrNull() ?: return false
    return !sessionDate.isAfter(today)
}

/**
 * Стоит ли ЕЩЁ СПРАШИВАТЬ про исход — то есть показывать «Была»/«Не пришли»
 * в списке дня.
 *
 * Отличие от [canRecordSessionOutcome] одно, и оно важное: здесь учитывается
 * [outcomeRecordedAt] — момент, когда исход назвал человек. Статус на это не
 * годится: сервер сам переводит CONFIRMED в COMPLETED через 15 минут после
 * конца встречи, и «COMPLETED» значит то ли «специалист сказал: была», то ли
 * «время прошло, и мы предположили». Пока исход не назван — спрашиваем;
 * назван — на месте кнопок остаётся подпись со статусом, и список дня
 * показывает, что уже сделано, а что нет.
 *
 * Экран деталей сессии этой функцией не пользуется намеренно: там исход
 * можно и уточнить задним числом, и [canRecordSessionOutcome] по-прежнему
 * держит эту дверь открытой.
 */
fun shouldAskSessionOutcome(
    date: String,
    status: SessionStatus,
    outcomeRecordedAt: String?,
    today: LocalDate = LocalDate.now(),
): Boolean {
    if (!outcomeRecordedAt.isNullOrBlank()) return false
    return canRecordSessionOutcome(date, status, today)
}
