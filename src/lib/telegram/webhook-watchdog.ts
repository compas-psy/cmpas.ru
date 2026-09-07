/**
 * Подстраховка доставки Telegram. Вебхук — главный, опрос — запасной.
 *
 * Обычный путь: Telegram сам стучится к нам и приносит сообщение. С
 * российского адреса это работает не всегда — 07.09.2026 пересланный
 * контакт пролежал у Telegram в очереди 23 минуты, а потом ещё раз, уже
 * дольше. В getWebhookInfo это видно дословно: pending_update_count
 * растёт, last_error_message — «Connection timed out».
 *
 * Тоннель эту сторону не лечит: через него МЫ ходим наружу, а здесь
 * наоборот — наружное должно найти нас.
 *
 * Устройство подстраховки, по порядку приоритета:
 *
 *   1. Вебхук здоров (очередь пуста) — сторож НЕ ДЕЛАЕТ НИЧЕГО. Один
 *      дешёвый вопрос раз в пять минут, и всё.
 *   2. Вебхука нет вовсе — ставим обратно. Это самолечение: если прошлый
 *      забор оборвался на полпути, следующий тик всё вернёт.
 *   3. Очередь копится И Telegram недавно жаловался на доставку — только
 *      тогда включается запасной путь: снимаем вебхук, забираем
 *      накопившееся через getUpdates по тоннелю, отдаём каждое обновление
 *      в НАШ ЖЕ вебхук-маршрут и ставим вебхук обратно.
 *   4. Очередь есть, но жалоб не было — не вмешиваемся: Telegram просто
 *      ещё не донёс, и лезть под руку незачем.
 *
 * Почему обновления отдаются в собственный маршрут, а не разбираются
 * здесь: разбор, проверка подлинности и все обработчики остаются ровно
 * теми же. Второго места, где живёт логика бота, не появляется — а
 * значит, ей неоткуда разойтись.
 *
 * Вебхук возвращается в блоке finally: даже если забор упадёт на середине,
 * главный путь восстановится. А если и это не удастся — пункт 2 на
 * следующем тике.
 */

const TELEGRAM_API_URL = process.env.TELEGRAM_API_URL || 'https://api.telegram.org';
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET;
const APP_URL = process.env.AUTH_URL || 'https://cmpas.ru';

/** Наш собственный вебхук — тот же адрес, что ставит выкладка. */
export const WEBHOOK_PATH = '/api/telegram/webhook';

/**
 * Насколько свежей должна быть жалоба Telegram, чтобы считать доставку
 * сломанной. Пять минут — период самого сторожа: жалоба старше уже
 * разобрана прошлым тиком либо доставка успела наладиться сама.
 */
const RECENT_FAILURE_MS = 5 * 60 * 1000;

/** Сколько обновлений забираем за один заход. Предел Telegram — 100. */
const BATCH = 100;

export type WatchdogOutcome =
    | { action: 'skipped'; reason: string }
    | { action: 'healthy'; pending: number }
    | { action: 'webhook_restored' }
    | { action: 'waiting'; pending: number }
    | { action: 'rescued'; delivered: number; failed: number; webhookRestored: boolean };

/** Из обновления нам нужен только его номер: остальное разбирает вебхук. */
type TelegramUpdate = { update_id: number };

type WebhookInfo = {
    url?: string;
    pending_update_count?: number;
    last_error_date?: number;
    last_error_message?: string;
};

/** Ответ Telegram: нас интересуют только ok и result, остальное не трогаем. */
type TelegramReply<T> = { ok?: boolean; result?: T };

async function callTelegram<T>(method: string, body?: Record<string, unknown>): Promise<TelegramReply<T> | null> {
    const url = `${TELEGRAM_API_URL}/bot${BOT_TOKEN}/${method}`;
    const init: RequestInit = {
        method: body ? 'POST' : 'GET',
        ...(body ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}),
    };

    // Тот же путь наружу, что у отправки сообщений: сначала тоннель, при
    // его отказе — напрямую. Иначе сторож на российском адресе не смог бы
    // даже спросить, что происходит.
    //
    // Загружаем модуль здесь, а не сверху файла: telegram-proxy тянет за
    // собой админ-флаги и весь next-auth. Статическим импортом это
    // попадало бы в граф instrumentation.ts, то есть в запуск приложения,
    // ради помощника, который нужен раз в пять минут.
    const { telegramSendAgent, nodeFetch } = await import('@/lib/telegram-proxy');
    const agent = await telegramSendAgent();
    if (agent) {
        try {
            const res = await nodeFetch()(url, { ...init, agent });
            return (await res.json()) as TelegramReply<T>;
        } catch (error) {
            console.warn('[tg-watchdog] через тоннель не вышло, пробуем напрямую:',
                error instanceof Error ? error.message : error);
        }
    }
    const res = await fetch(url, init);
    return (await res.json()) as TelegramReply<T>;
}

/** Отдать обновление собственному вебхуку — тому же коду, что и всегда. */
async function feedToOwnWebhook(update: unknown): Promise<boolean> {
    try {
        const res = await fetch(`http://127.0.0.1:3000${WEBHOOK_PATH}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                // Маршрут проверяет этот заголовок и без него молча
                // отвечает 200, не обрабатывая — то есть тихо потеряет
                // спасённое обновление.
                ...(WEBHOOK_SECRET ? { 'x-telegram-bot-api-secret-token': WEBHOOK_SECRET } : {}),
            },
            body: JSON.stringify(update),
        });
        return res.ok;
    } catch (error) {
        console.error('[tg-watchdog] обновление не отдалось своему же вебхуку:',
            error instanceof Error ? error.message : error);
        return false;
    }
}

async function setWebhook(): Promise<boolean> {
    const result = await callTelegram<boolean>('setWebhook', {
        url: `${APP_URL}${WEBHOOK_PATH}`,
        drop_pending_updates: false,
        ...(WEBHOOK_SECRET ? { secret_token: WEBHOOK_SECRET } : {}),
    });
    return Boolean(result?.ok);
}

export async function rescueUndeliveredTelegramUpdates(): Promise<WatchdogOutcome> {
    if (!BOT_TOKEN) return { action: 'skipped', reason: 'нет TELEGRAM_BOT_TOKEN' };

    const info = (await callTelegram<WebhookInfo>('getWebhookInfo'))?.result;
    if (!info) return { action: 'skipped', reason: 'Telegram не ответил на getWebhookInfo' };

    // Вебхука нет — вернуть его важнее всего остального.
    if (!info.url) {
        const restored = await setWebhook();
        console.warn(`[tg-watchdog] вебхук не был установлен; восстановление: ${restored ? 'удалось' : 'НЕ УДАЛОСЬ'}`);
        return { action: 'webhook_restored' };
    }

    const pending = info.pending_update_count ?? 0;
    if (pending === 0) return { action: 'healthy', pending: 0 };

    const lastErrorAgoMs = info.last_error_date ? Date.now() - info.last_error_date * 1000 : Infinity;
    if (lastErrorAgoMs > RECENT_FAILURE_MS) {
        // Очередь есть, но жалоб не было: Telegram просто ещё не донёс.
        return { action: 'waiting', pending };
    }

    console.warn(`[tg-watchdog] Telegram не может доставить ${pending} обновлений `
        + `(«${info.last_error_message ?? 'без описания'}»). Забираем сами.`);

    let delivered = 0;
    let failed = 0;
    let webhookRestored = false;

    try {
        // Снимаем вебхук БЕЗ drop_pending_updates: очередь и есть то, что
        // мы пришли спасать.
        await callTelegram('deleteWebhook', { drop_pending_updates: false });

        let offset: number | undefined;
        for (;;) {
            const batch = await callTelegram<TelegramUpdate[]>('getUpdates', {
                ...(offset === undefined ? {} : { offset }),
                limit: BATCH,
                timeout: 0, // забор, а не ожидание: сторож не должен висеть
            });
            const updates: TelegramUpdate[] = Array.isArray(batch?.result) ? batch.result : [];
            if (updates.length === 0) break;

            for (const update of updates) {
                if (await feedToOwnWebhook(update)) delivered++;
                else failed++;
            }

            offset = updates[updates.length - 1].update_id + 1;
            if (updates.length < BATCH) break;
        }

        // Подтверждаем разобранное: без этого Telegram отдаст те же
        // обновления снова, и человек получит повтор ответа.
        if (offset !== undefined) {
            await callTelegram<TelegramUpdate[]>('getUpdates', { offset, limit: 1, timeout: 0 });
        }
    } finally {
        // Вебхук — главный путь, и он возвращается всегда: даже если забор
        // оборвался на середине. Не удалось и это — следующий тик увидит
        // пустой url и поставит заново.
        webhookRestored = await setWebhook();
        if (!webhookRestored) {
            console.error('[tg-watchdog] ВЕБХУК НЕ ВОССТАНОВЛЕН — следующий тик попробует снова');
        }
    }

    console.warn(`[tg-watchdog] спасено обновлений: ${delivered}, не удалось: ${failed}; `
        + `вебхук ${webhookRestored ? 'возвращён' : 'НЕ возвращён'}`);
    return { action: 'rescued', delivered, failed, webhookRestored };
}
