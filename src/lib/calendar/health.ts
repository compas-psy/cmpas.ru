import { db } from '@/lib/db';
import { createNotification } from '@/lib/notifications';

/**
 * ЖИВО ЛИ ПОДКЛЮЧЕНИЕ КАЛЕНДАРЯ.
 *
 * Дефект Ф10 книги «Витрина и машинное отделение». Провайдер отзывает доступ
 * по многим поводам: сменили пароль, полгода не заходили, отозвали
 * разрешение в своём аккаунте, сменили пароль приложения Яндекса. В этот
 * момент выгрузка встреч прекращается — а узнать об этом было неоткуда:
 * отказ уходил в журнал без персональных данных и дальше журнала не шёл.
 * Подключение оставалось помеченным рабочим, на экране горело «Подключён»,
 * и специалист продолжал верить, что его встречи попадают в календарь,
 * которым он пользуется каждый день.
 *
 * Здесь нечего чинить в самой синхронизации: она честно пытается. Чинится
 * то, что экран показывает состояние, которого нет.
 *
 * ЧЕГО ЗДЕСЬ НЕТ. Автоматического переподключения: молча обновить чужой
 * доступ нельзя, у провайдера его отозвал человек и вернуть должен человек.
 * И отключения подключения при первом отказе: сеть моргает чаще, чем
 * отзывают доступ, а «мы сами вас отключили» — худшее, что можно сказать
 * тому, у кого просто был плохой интернет.
 */

/** Категории отказа. Текст провайдера сюда не попадает никогда. */
export type CalendarErrorCode =
    | 'PROVIDER_AUTH'
    | 'PROVIDER_TIMEOUT'
    | 'PROVIDER_UNREACHABLE'
    | 'PROVIDER_ERROR';

/**
 * Отказ в доступе — единственный, про который человеку надо сказать сразу.
 *
 * Остальные отличаются от него тем, что проходят сами: таймаут, недоступная
 * сеть, пятисотка у провайдера. Поэтому «сломано» показывается только на
 * отказе доступа, а прочие отказы просто запоминаются последним кодом — по
 * ним видно, что происходит, если однажды придётся разбираться.
 */
export function isAccessRevoked(code: CalendarErrorCode): boolean {
    return code === 'PROVIDER_AUTH';
}

/** Ответ провайдера говорит, что доступа больше нет. */
export function looksLikeAccessRevoked(status?: number | null, message?: string | null): boolean {
    if (status === 401 || status === 403) return true;
    const text = (message || '').toLowerCase();
    // Слова самих провайдеров, как они приходят на деле:
    //   Google, отозванный refresh-токен → invalid_grant;
    //   Google, протухший access-токен   → «Request had invalid
    //                                      authentication credentials», код 401;
    //   CalDAV Яндекса                    → 401 Unauthorized.
    // Числа ищутся как отдельное слово: «401» внутри идентификатора события
    // не должно выглядеть отказом доступа.
    return /invalid_grant|invalid_client|unauthorized_client|invalid_token/.test(text)
        || text.includes('invalid authentication credentials')
        || text.includes('invalid credentials')
        || text.includes('unauthorized')
        || /\b(401|403)\b/.test(text);
}

/**
 * Записать отказ. Возвращает true, если подключение ТОЛЬКО ЧТО сломалось —
 * по этому переходу и посылается уведомление, иначе оно приходило бы каждые
 * пятнадцать минут, пока человек не починит.
 */
export async function markCalendarBroken(params: {
    integrationId: string;
    psychologistId: string;
    provider: string;
    code: CalendarErrorCode;
    now?: Date;
}): Promise<boolean> {
    const now = params.now ?? new Date();
    try {
        const before = await db.calendarIntegration.findUnique({
            where: { id: params.integrationId },
            select: { lastErrorAt: true, lastErrorCode: true },
        });
        await db.calendarIntegration.update({
            where: { id: params.integrationId },
            data: { lastErrorAt: now, lastErrorCode: params.code },
        });

        const wasHealthy = !before?.lastErrorAt || !isAccessRevoked((before.lastErrorCode || '') as CalendarErrorCode);
        if (!isAccessRevoked(params.code) || !wasHealthy) return false;

        await createNotification({
            psychologistId: params.psychologistId,
            type: 'calendar_broken',
            title: providerTitle(params.provider),
            subtitle: 'Встречи перестали уходить в календарь. Нужно подключить заново',
            refId: params.integrationId,
        });
        return true;
    } catch {
        // Наблюдаемость тише самой синхронизации: отказ здесь не должен
        // мешать ни отправке, ни созданию встречи.
        return false;
    }
}

/** Подключение снова отвечает — отметка снимается. */
export async function markCalendarHealthy(integrationId: string): Promise<void> {
    try {
        const before = await db.calendarIntegration.findUnique({
            where: { id: integrationId },
            select: { lastErrorAt: true },
        });
        if (!before?.lastErrorAt) return;
        await db.calendarIntegration.update({
            where: { id: integrationId },
            data: { lastErrorAt: null, lastErrorCode: null },
        });
    } catch {
        /* см. выше */
    }
}

function providerTitle(provider: string): string {
    if (provider === 'google') return 'Google Календарь не отвечает';
    if (provider === 'yandex') return 'Яндекс Календарь не отвечает';
    return 'Календарь не отвечает';
}
