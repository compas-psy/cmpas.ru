/**
 * ПОДПИСКА MAX НА СОБЫТИЯ: ПОСТАНОВКА И СТОРОЖ.
 *
 * Дефекты Ф14 и Ф15 книги «Витрина и машинное отделение».
 *
 * Ф15. Подписка ставилась один раз при запуске и больше не проверялась. У
 * Telegram всё иначе: каждые пять минут сторож спрашивает, на месте ли
 * вебхук, и возвращает его, если нет. Тот сторож написан не из
 * предосторожности — его написали после того, как подписка однажды отвалилась
 * и сообщения перестали доходить. MAX — второй по важности канал продукта и
 * единственный для части людей: если его подписка отвалится, продукт
 * замолчит для них целиком и узнает об этом от них же.
 *
 * Ф14. Ответ MAX печатался в журнал целиком, как пришёл. Что в нём — решаем
 * не мы: сегодня «готово», завтра вся подписка вместе с секретом, которым
 * она подписана. Секрет вебхука — то, чем проверяется, что событие пришло от
 * MAX, а не от постороннего; в журнале ему не место ни при каких
 * обстоятельствах. Здесь наружу выходит только наше собственное суждение:
 * получилось или нет, и по какой категории отказа.
 *
 * ЧЕГО ЗДЕСЬ НЕТ. Снятия подписки перед постановкой. Раньше при каждом
 * запуске сначала шёл DELETE, потом POST — и между ними было мгновение, в
 * котором подписки не существовало; события этого мгновения терялись.
 * Теперь подписка ставится, только если её нет.
 */

const MAX_API = 'https://platform-api2.max.ru';

/** Что случилось. Наружу — только это, без ответа провайдера. */
export type MaxWebhookOutcome =
    | 'already-registered'
    | 'registered'
    | 'no-token'
    | 'check-failed'
    | 'register-failed';

export function maxWebhookUrl(): string {
    const appUrl = process.env.AUTH_URL || 'https://cmpas.ru';
    return `${appUrl}/api/max/webhook`;
}

async function listSubscriptionUrls(token: string): Promise<string[] | null> {
    try {
        const res = await fetch(`${MAX_API}/subscriptions`, {
            method: 'GET',
            headers: { Authorization: token },
            signal: AbortSignal.timeout(10000),
        });
        if (!res.ok) return null;
        const data = await res.json().catch(() => null);
        const list: Array<{ url?: unknown }> = Array.isArray(data?.subscriptions) ? data.subscriptions : [];
        // Наружу возвращаются только адреса — и только наши: остальное из
        // ответа провайдера дальше этой функции не идёт.
        return list.map((item) => String(item?.url ?? '')).filter(Boolean);
    } catch {
        return null;
    }
}

/**
 * Убедиться, что подписка на месте; поставить, если нет.
 *
 * Зовётся и при запуске, и каждые пять минут сторожем. Идемпотентна:
 * существующую подписку не трогает.
 */
export async function ensureMaxWebhook(): Promise<MaxWebhookOutcome> {
    const token = process.env.MAX_BOT_TOKEN;
    if (!token) return 'no-token';

    const url = maxWebhookUrl();
    const existing = await listSubscriptionUrls(token);
    if (existing === null) return 'check-failed';
    if (existing.includes(url)) return 'already-registered';

    try {
        const res = await fetch(`${MAX_API}/subscriptions`, {
            method: 'POST',
            headers: { Authorization: token, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                url,
                // Имена типов событий у MAX именно такие: 'message_callback',
                // а не 'callback_button_pressed'.
                update_types: ['bot_started', 'message_created', 'message_callback'],
                ...(process.env.MAX_WEBHOOK_SECRET ? { secret: process.env.MAX_WEBHOOK_SECRET } : {}),
            }),
            signal: AbortSignal.timeout(10000),
        });
        // Тело ответа не читается и не печатается: нам достаточно кода.
        return res.ok ? 'registered' : 'register-failed';
    } catch {
        return 'register-failed';
    }
}

/**
 * Сторож: то же самое, но со строкой в журнале, когда есть что сказать.
 *
 * Молчит, пока всё на месте, — иначе журнал за сутки наполнится тремя
 * сотнями строк «подписка на месте», и в них утонет та единственная, ради
 * которой сторож написан.
 */
export async function watchMaxWebhook(): Promise<MaxWebhookOutcome> {
    const outcome = await ensureMaxWebhook();
    if (outcome === 'registered') {
        console.warn('[max-watchdog] подписки не было — поставлена заново');
    } else if (outcome === 'register-failed') {
        console.error('[max-watchdog] ПОДПИСКА НЕ ВОССТАНОВЛЕНА — следующий тик попробует снова');
    } else if (outcome === 'check-failed') {
        console.error('[max-watchdog] не удалось проверить подписку');
    }
    return outcome;
}
