package ru.cmpas.app.presentation.util

import ru.cmpas.app.domain.model.Session
import ru.cmpas.app.domain.model.SessionFormat
import ru.cmpas.app.domain.model.SessionStatus
import java.time.LocalDate

/**
 * ЧТО МОЖНО СДЕЛАТЬ С ЭТОЙ ВСТРЕЧЕЙ.
 *
 * До 10.09.2026 нижняя панель экрана встречи не смотрела ни на статус, ни на
 * дату — в ней не было ни одного условия. Учредитель отметил встречу как
 * состоявшуюся и увидел под ней «Подключиться», «Перенести» и «Отменить»:
 *
 *     «Если сессия закончилась, то зачем подключаться? Я уже отметил, что
 *      сессия Была — если не была, то другое дело.»
 *
 * Последние пять слов и есть правило. Дверь закрывает не время, а НАЗВАННЫЙ
 * ИСХОД: пока специалист не сказал, состоялась ли встреча, он вправе к ней
 * подключиться, перенести её и отменить, даже если час уже прошёл — люди
 * опаздывают, и встреча в 13:00 вполне может начаться в 13:20.
 *
 * Одно исключение — вчерашний день и раньше. Там подключаться не к чему,
 * отметил специалист исход или забыл: время прошло целиком, а не «пока».
 *
 * Статус для этого не годится сам по себе: сервер переводит CONFIRMED в
 * COMPLETED через 15 минут после конца встречи, и «COMPLETED» значит то ли
 * «специалист сказал: была», то ли «время прошло, и мы предположили». Слово
 * человека отличает outcomeRecordedAt — то же поле, на котором стоит развилка
 * в списке дня (см. shouldAskSessionOutcome).
 */
enum class SessionAction {
    /** Открыть ссылку видеовстречи. */
    CONNECT,

    /** Написать клиенту. */
    MESSAGE,

    /** Заметка по встрече. */
    NOTE,

    /** Отметить оплату. */
    PAYMENT,

    /** Перенести эту встречу на другое время. */
    RESCHEDULE,

    /** Отменить эту встречу. */
    CANCEL,

    /** Записать этого же клиента снова. */
    REBOOK,
}

/**
 * Вопрос по встрече закрыт: исход назвал человек или встреча отменена.
 *
 * NO_SHOW сервер не ставит никогда — это всегда сказанное специалистом слово,
 * поэтому оно считается названным исходом и без отметки времени (так приходят
 * встречи, отмеченные до появления поля).
 */
fun isSessionSettled(status: SessionStatus, outcomeRecordedAt: String?): Boolean =
    !outcomeRecordedAt.isNullOrBlank() ||
        status == SessionStatus.NO_SHOW ||
        status == SessionStatus.CANCELLED

/** День встречи уже позади — не «час прошёл», а сутки закрылись. */
fun isSessionDayOver(date: String, today: LocalDate = LocalDate.now()): Boolean {
    val sessionDate = runCatching { LocalDate.parse(date) }.getOrNull() ?: return false
    return sessionDate.isBefore(today)
}

/**
 * Набор действий для встречи — в том порядке, в каком они стоят на экране.
 *
 * Порядок не косметика: первым идёт то, ради чего человек сюда и зашёл.
 * У предстоящей встречи это «Подключиться», у прошедшей — «Записать снова»:
 * следующая запись после состоявшейся встречи и есть главный смысл экрана.
 */
fun sessionActions(session: Session, today: LocalDate = LocalDate.now()): List<SessionAction> {
    // Отменённая встреча не переносится и не оплачивается: её больше нет.
    // Остаётся то, что связывает со следующей, — записать снова и написать.
    if (session.status == SessionStatus.CANCELLED) {
        return listOf(SessionAction.REBOOK, SessionAction.MESSAGE)
    }

    val closed = isSessionSettled(session.status, session.outcomeRecordedAt) || isSessionDayOver(session.date, today)
    if (closed) {
        return listOf(
            SessionAction.REBOOK,
            SessionAction.NOTE,
            SessionAction.MESSAGE,
            SessionAction.PAYMENT,
        )
    }

    return buildList {
        if (session.format == SessionFormat.ONLINE) add(SessionAction.CONNECT)
        add(SessionAction.MESSAGE)
        add(SessionAction.NOTE)
        add(SessionAction.PAYMENT)
        add(SessionAction.RESCHEDULE)
        add(SessionAction.CANCEL)
    }
}
