/**
 * ЧТО МОЖНО СДЕЛАТЬ С ЭТОЙ ВСТРЕЧЕЙ — одно правило на веб и приложение.
 *
 * До 10.09.2026 нижняя панель экрана встречи в приложении не смотрела ни на
 * статус, ни на дату: в ней не было ни одного условия. Учредитель отметил
 * встречу как состоявшуюся и увидел под ней «Подключиться», «Перенести» и
 * «Отменить»:
 *
 *     «Если сессия закончилась, то зачем подключаться? Я уже отметил, что
 *      сессия Была — если не была, то другое дело.»
 *
 * Последние пять слов — само правило. Дверь закрывает не время, а НАЗВАННЫЙ
 * ИСХОД: пока специалист не сказал, состоялась ли встреча, он вправе к ней
 * подключиться, перенести её и отменить, даже если час уже прошёл — люди
 * опаздывают, и встреча в 13:00 вполне может начаться в 13:20. Исключение
 * одно: вчерашний день и раньше. Там подключаться не к чему, отметил
 * специалист исход или забыл.
 *
 * Статус для этого не годится сам по себе: сервер переводит confirmed в
 * completed через 15 минут после конца встречи
 * (settlePastSessionsForPsychologist), и «completed» значит то ли «специалист
 * сказал: была», то ли «время прошло, и мы предположили». Слово человека
 * отличает outcomeRecordedAt.
 *
 * ЗЕРКАЛО В ПРИЛОЖЕНИИ: android/.../presentation/util/SessionActions.kt.
 * Правило одно, и оба файла обязаны отвечать одинаково — экран встречи в вебе
 * и в приложении показывает человеку одно и то же. Расхождение здесь тем и
 * опасно, что не падает: просто в одном месте кнопка есть, а в другом нет.
 */

export type SessionActionKind =
    | 'connect'
    | 'message'
    | 'note'
    | 'payment'
    | 'reschedule'
    | 'cancel'
    | 'rebook';

export interface SessionForActions {
    status: string;
    outcomeRecordedAt?: Date | string | null;
    date: Date;
    format: string;
}

/**
 * Вопрос по встрече закрыт: исход назвал человек или встреча отменена.
 *
 * no_show сервер не ставит никогда — это всегда сказанное специалистом слово,
 * поэтому считается названным исходом и без отметки времени (так приходят
 * встречи, отмеченные до появления поля).
 */
export function isSessionSettled(status: string, outcomeRecordedAt?: Date | string | null): boolean {
    if (outcomeRecordedAt) return true;
    return status === 'no_show' || status === 'cancelled';
}

/** День встречи уже позади — не «час прошёл», а сутки закрылись. */
export function isSessionDayOver(date: Date, now: Date = new Date()): boolean {
    const day = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
    const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
    return day < today;
}

/**
 * Набор действий в том порядке, в каком они стоят на экране.
 *
 * Порядок не косметика: первым идёт то, ради чего человек сюда и зашёл. У
 * предстоящей встречи это «Подключиться», у прошедшей — «Записать снова»:
 * следующая запись после состоявшейся встречи и есть главный смысл экрана.
 */
export function sessionActions(session: SessionForActions, now: Date = new Date()): SessionActionKind[] {
    // Отменённая встреча не переносится и не оплачивается: её больше нет.
    // Остаётся то, что связывает со следующей.
    if (session.status === 'cancelled') return ['rebook', 'message'];

    const closed = isSessionSettled(session.status, session.outcomeRecordedAt) || isSessionDayOver(session.date, now);
    if (closed) return ['rebook', 'note', 'message', 'payment'];

    const actions: SessionActionKind[] = [];
    if (session.format !== 'offline') actions.push('connect');
    actions.push('message', 'note', 'payment', 'reschedule', 'cancel');
    return actions;
}

/** Подпись кнопки оплаты: пока можно отметить — это действие, потом состояние. */
export function paymentActionLabel(paymentStatus: string): { label: string; enabled: boolean } {
    return paymentStatus === 'paid'
        ? { label: 'Оплачено', enabled: false }
        : { label: 'Отметить оплату', enabled: true };
}
