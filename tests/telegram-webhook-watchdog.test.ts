// Подстраховка доставки Telegram: вебхук главный, опрос запасной.
//
// Проверяется прежде всего то, ради чего заведено это устройство, — что
// подстраховка НЕ лезет, пока главный путь работает. Сторож, который
// снимает вебхук «на всякий случай», хуже отсутствия сторожа: он сам
// становится источником потерь.
//
// Второе по важности — что вебхук возвращается всегда. Оставить систему
// без вебхука и без опроса значит выключить бота совсем, и никакая
// диагностика этого не покажет: снаружи это просто тишина.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/lib/telegram-proxy', () => ({
    // Тоннеля в тесте нет: пусть сторож идёт обычным fetch, который мы и
    // подменяем ниже.
    telegramSendAgent: async () => undefined,
    nodeFetch: () => fetch,
}));

const ORIGINAL_FETCH = globalThis.fetch;
const ORIGINAL_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const ORIGINAL_HOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET;

/** Что ответил Telegram на каждый метод и что у нас спросили. */
type Call = { method: string; body: Record<string, unknown> | undefined };

type Canned = unknown | ((body: Record<string, unknown> | undefined) => unknown);

function mockTelegram(responses: Record<string, Canned>, calls: Call[]) {
    globalThis.fetch = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
        const address = String(url);
        const body = typeof init?.body === 'string' ? JSON.parse(init.body) : undefined;

        // Наш собственный вебхук — сюда сторож отдаёт спасённое.
        if (address.includes('/api/telegram/webhook')) {
            calls.push({ method: 'ownWebhook', body });
            return new Response('{}', { status: 200 });
        }

        const method = address.split('/').pop() as string;
        calls.push({ method, body });
        const canned = responses[method];
        const payload = typeof canned === 'function'
            ? (canned as (b: Record<string, unknown> | undefined) => unknown)(body)
            : canned;
        return new Response(JSON.stringify(payload ?? {}), { status: 200 });
    });
}

async function run() {
    vi.resetModules();
    const { rescueUndeliveredTelegramUpdates } = await import('../src/lib/telegram/webhook-watchdog');
    return rescueUndeliveredTelegramUpdates();
}

const WEBHOOK = 'https://cmpas.ru/api/telegram/webhook';
const justNow = () => Math.floor(Date.now() / 1000) - 30;

describe('подстраховка доставки Telegram', () => {
    // Окружение восстанавливаем целиком: последняя проверка удаляет
    // токен бота, и без возврата она ломала бы соседние файлы, которые
    // читают его при загрузке модуля.
    afterEach(() => {
        globalThis.fetch = ORIGINAL_FETCH;
        if (ORIGINAL_TOKEN === undefined) delete process.env.TELEGRAM_BOT_TOKEN;
        else process.env.TELEGRAM_BOT_TOKEN = ORIGINAL_TOKEN;
        if (ORIGINAL_HOOK_SECRET === undefined) delete process.env.TELEGRAM_WEBHOOK_SECRET;
        else process.env.TELEGRAM_WEBHOOK_SECRET = ORIGINAL_HOOK_SECRET;
    });

    beforeEach(() => {
        process.env.TELEGRAM_BOT_TOKEN = 'test-token';
        process.env.TELEGRAM_WEBHOOK_SECRET = 'test-secret';
    });

    it('вебхук работает — сторож не трогает ничего', async () => {
        const calls: Call[] = [];
        mockTelegram({ getWebhookInfo: { ok: true, result: { url: WEBHOOK, pending_update_count: 0 } } }, calls);

        expect(await run()).toEqual({ action: 'healthy', pending: 0 });
        // Ровно один вопрос — и ни одного вмешательства.
        expect(calls.map(c => c.method)).toEqual(['getWebhookInfo']);
    });

    it('очередь копится, но жалоб не было — не лезем под руку', async () => {
        const calls: Call[] = [];
        mockTelegram({
            getWebhookInfo: {
                ok: true,
                result: { url: WEBHOOK, pending_update_count: 3, last_error_date: Math.floor(Date.now() / 1000) - 3600 },
            },
        }, calls);

        expect(await run()).toEqual({ action: 'waiting', pending: 3 });
        expect(calls.map(c => c.method)).toEqual(['getWebhookInfo']);
    });

    it('Telegram не может достучаться — забираем сами и возвращаем вебхук', async () => {
        const calls: Call[] = [];
        let drained = false;
        mockTelegram({
            getWebhookInfo: {
                ok: true,
                result: { url: WEBHOOK, pending_update_count: 2, last_error_date: justNow(), last_error_message: 'Connection timed out' },
            },
            deleteWebhook: { ok: true },
            getUpdates: () => {
                if (drained) return { ok: true, result: [] };
                drained = true;
                return { ok: true, result: [{ update_id: 10, message: { text: 'раз' } }, { update_id: 11, message: { text: 'два' } }] };
            },
            setWebhook: { ok: true },
        }, calls);

        expect(await run()).toEqual({ action: 'rescued', delivered: 2, failed: 0, webhookRestored: true });

        const methods = calls.map(c => c.method);
        expect(methods).toContain('deleteWebhook');
        // Оба обновления ушли в НАШ ЖЕ маршрут: второго места с логикой
        // бота не появляется.
        expect(methods.filter(m => m === 'ownWebhook')).toHaveLength(2);
        // Вебхук возвращён — и это последнее, что делает сторож.
        expect(methods[methods.length - 1]).toBe('setWebhook');
    });

    it('снимая вебхук, очередь не выбрасывается — её и спасаем', async () => {
        const calls: Call[] = [];
        mockTelegram({
            getWebhookInfo: { ok: true, result: { url: WEBHOOK, pending_update_count: 1, last_error_date: justNow() } },
            deleteWebhook: { ok: true },
            getUpdates: { ok: true, result: [] },
            setWebhook: { ok: true },
        }, calls);

        await run();

        const del = calls.find(c => c.method === 'deleteWebhook');
        expect(del?.body?.drop_pending_updates).toBe(false);
    });

    it('забор оборвался — вебхук всё равно возвращается', async () => {
        const calls: Call[] = [];
        mockTelegram({
            getWebhookInfo: { ok: true, result: { url: WEBHOOK, pending_update_count: 1, last_error_date: justNow() } },
            deleteWebhook: { ok: true },
            getUpdates: () => { throw new Error('сеть отвалилась посреди забора'); },
            setWebhook: { ok: true },
        }, calls);

        // Ошибка не глотается — крон её увидит и запишет.
        await expect(run()).rejects.toThrow();
        // Но система не остаётся без главного пути.
        expect(calls.map(c => c.method)).toContain('setWebhook');
    });

    it('вебхука нет вовсе — ставим обратно, это самолечение', async () => {
        const calls: Call[] = [];
        mockTelegram({
            getWebhookInfo: { ok: true, result: { url: '', pending_update_count: 0 } },
            setWebhook: { ok: true },
        }, calls);

        expect(await run()).toEqual({ action: 'webhook_restored' });
        expect(calls.map(c => c.method)).toEqual(['getWebhookInfo', 'setWebhook']);
    });

    it('спасённое отдаётся своему вебхуку с секретом — иначе он его молча отбросит', async () => {
        const calls: Call[] = [];
        let drained = false;
        mockTelegram({
            getWebhookInfo: { ok: true, result: { url: WEBHOOK, pending_update_count: 1, last_error_date: justNow() } },
            deleteWebhook: { ok: true },
            getUpdates: () => {
                if (drained) return { ok: true, result: [] };
                drained = true;
                return { ok: true, result: [{ update_id: 7, message: { text: 'привет' } }] };
            },
            setWebhook: { ok: true },
        }, calls);

        await run();

        const fed = vi.mocked(globalThis.fetch).mock.calls
            .find((c) => String(c[0]).includes('/api/telegram/webhook'));
        const headers = fed?.[1]?.headers as Record<string, string>;
        expect(headers['x-telegram-bot-api-secret-token']).toBe('test-secret');
    });

    it('без токена бота сторож ничего не делает', async () => {
        delete process.env.TELEGRAM_BOT_TOKEN;
        const calls: Call[] = [];
        mockTelegram({}, calls);

        expect(await run()).toEqual({ action: 'skipped', reason: 'нет TELEGRAM_BOT_TOKEN' });
        expect(calls).toHaveLength(0);
    });
});
