import { publicBaseUrl, sessionActionToken, sessionActionTokenExpiry } from '@/lib/client-workflow';

/**
 * ТРИ ДЕЙСТВИЯ КЛИЕНТА ПО ВСТРЕЧЕ — ОДНИ И ТЕ ЖЕ АДРЕСА ВЕЗДЕ.
 *
 * Строка «Подтвердить, перенести или отменить встречу можно здесь» обещала
 * человеку три действия. Ссылка при этом вела на страницу НОВОЙ записи, где
 * не было ни одного из них, а кнопка «Перенести» в напоминании — туда же,
 * хотя страница переноса конкретной встречи существует и работает.
 *
 * Причина была в том, что адреса собирались по месту: в рассылке — свои, в
 * сообщении о записи — никаких. Здесь они собираются один раз.
 *
 * Каждый адрес несёт СВОЙ подписанный токен: токен подтверждения не работает
 * как токен отмены, и ни один из них — на другой встрече. Это не украшение
 * (Задача 3, пункт D): раньше один статический токен на клиента годился и
 * для отмены чужой встречи.
 */

export interface SessionActionLinkInput {
    psychologistId: string;
    clientId: string;
    sessionId: string;
    /** Дата встречи: от неё считается, когда ссылки перестают работать. */
    date: Date;
}

export interface SessionActionLinks {
    confirm: string;
    reschedule: string;
    cancel: string;
}

export function sessionActionLinks(input: SessionActionLinkInput): SessionActionLinks {
    const expiresAt = sessionActionTokenExpiry(input.date);
    const token = (action: 'confirm' | 'cancel' | 'reschedule') =>
        sessionActionToken(input.psychologistId, input.clientId, input.sessionId, action, expiresAt);
    const base = publicBaseUrl();
    const actionUrl = (action: 'confirm' | 'cancel') =>
        `${base}/api/client/session-action?s=${input.sessionId}&a=${action}&t=${token(action)}`;

    return {
        confirm: actionUrl('confirm'),
        // Перенос конкретной встречи, а не страница новой записи: страница
        // существует, умеет ровно это и проверяет токен именно на перенос.
        reschedule: `${base}/client/reschedule/${input.sessionId}?t=${token('reschedule')}`,
        cancel: actionUrl('cancel'),
    };
}

/**
 * Кнопки под сообщением о встрече.
 *
 * Учредитель 10.09.2026: «кнопки Подтверждаю, Перенести, Отменить» — ровно
 * три, столько же, сколько действий обещает строка над ними.
 *
 * Отмена стоит отдельным рядом, не бок о бок с подтверждением: промах пальцем
 * здесь стоит встречи.
 *
 * `includeConfirm` = false там, где клиент уже подтвердил: предлагать
 * подтвердить дважды — значит делать вид, что первого раза не было.
 */
export function sessionActionButtons(
    input: SessionActionLinkInput,
    options: { includeConfirm: boolean },
): Array<Array<{ text: string; url: string }>> {
    const links = sessionActionLinks(input);
    const rows: Array<Array<{ text: string; url: string }>> = [];
    if (options.includeConfirm) rows.push([{ text: 'Подтверждаю', url: links.confirm }]);
    rows.push([
        { text: 'Перенести', url: links.reschedule },
        { text: 'Отменить', url: links.cancel },
    ]);
    return rows;
}
