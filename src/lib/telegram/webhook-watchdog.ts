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
 *      ТОМУ ЖЕ обработчику, что и вебхук, и ставим вебхук обратно.
 *   4. Очередь есть, но жалоб не было — не вмешиваемся: Telegram просто
 *      ещё не донёс, и лезть под руку незачем.
 *
 * Почему обновления отдаются общему обработчику, а не разбираются здесь:
 * разбор и все обработчики остаются ровно теми же. Второго места, где
 * живёт логика бота, не появляется — а значит, ей неоткуда разойтись.
 *
 * Подтверждение забранного (offset) двигается только за успешно
 * обработанным. Иначе получается тихая потеря: у Telegram обновления уже
 * нет, а до обработчика оно не дошло.
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

/** Из обновления нам нужен только его номер: остальное разбирает обработчик. */
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

/**
 * Обработать спасённое обновление тем же кодом, что и обычный вебхук.
 *
 * Раньше здесь был HTTP-стук к самому себе на 127.0.0.1:3000 — и он не
 * проходил ни разу: standalone-сборка Next.js слушает на имени из HOSTNAME,
 * а docker кладёт туда идентификатор контейнера, то есть приложение слушает
 * на IP контейнера, но НЕ на петле. Это уже было выяснено и записано в
 * scripts/db-doctor.sh («Куда на самом деле слушает приложение»), и всё
 * равно повторилось: обновление забиралось у Telegram, не доходило до
 * обработчика и подтверждалось как разобранное — то есть исчезало совсем.
 *
 * Сети внутри собственного процесса больше нет. Проверка секрета не нужна:
 * обновление мы взяли у Telegram сами, его подлинность и есть источник.
 */
async function handleRescuedUpdate(update: unknown): Promise<boolean> {
    try {
        const { processTelegramUpdate } = await import('@/lib/telegram/process-update');
        await processTelegramUpdate(update);
        return true;
    } catch (error) {
        console.error('[tg-watchdog] обновление не обработалось:',
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

        // offset у Telegram — это И запрос следующей порции, И подтверждение
        // всего, что до него. Поэтому двигаем его ТОЛЬКО за успешно
        // обработанным обновлением: не справились — обрываем забор и
        // оставляем остаток в очереди, чтобы вернувшийся вебхук принёс его
        // снова. Потерять обновление хуже, чем принести его позже.
        let confirmed: number | undefined;
        for (;;) {
            const batch = await callTelegram<TelegramUpdate[]>('getUpdates', {
                ...(confirmed === undefined ? {} : { offset: confirmed }),
                limit: BATCH,
                timeout: 0, // забор, а не ожидание: сторож не должен висеть
            });
            const updates: TelegramUpdate[] = Array.isArray(batch?.result) ? batch.result : [];
            if (updates.length === 0) break;

            let stopped = false;
            for (const update of updates) {
                if (await handleRescuedUpdate(update)) {
                    delivered++;
                    confirmed = update.update_id + 1;
                } else {
                    failed++;
                    stopped = true;
                    break;
                }
            }

            if (stopped || updates.length < BATCH) break;
        }

        // Подтверждаем ровно разобранное: без этого Telegram отдаст те же
        // обновления снова, и человек получит повтор ответа.
        if (confirmed !== undefined) {
            await callTelegram<TelegramUpdate[]>('getUpdates', { offset: confirmed, limit: 1, timeout: 0 });
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
