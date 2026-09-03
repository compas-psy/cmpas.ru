// Task 2 (PRAKTIKA MVP addendum): подлинность MAX webhook. До фикса
// POST /api/max/webhook обрабатывал любой вход без проверки источника —
// кто угодно, зная публичный URL, мог слать поддельные апдейты (например,
// bot_started с угаданным invite-токеном). Проверяется НАСТОЯЩИЙ обработчик
// маршрута, а не его пересказ.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const handleMaxUpdate = vi.fn().mockResolvedValue(undefined);
vi.mock('@/lib/max-bot', () => ({
    handleMaxUpdate: (...args: unknown[]) => handleMaxUpdate(...args),
    sendMaxMessage: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/db', () => ({
    db: {
        scheduledClientMessage: {
            findMany: vi.fn().mockResolvedValue([]),
            update: vi.fn(),
        },
    },
}));

vi.mock('@/lib/channel-binding', () => ({
    consumeClientChannelInvite: vi.fn(),
}));

vi.mock('@/lib/person-name', () => ({
    extractFirstName: (name: string) => name,
}));

function post(headers: Record<string, string> = {}) {
    return new Request('https://cmpas.ru/api/max/webhook', {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...headers },
        body: JSON.stringify({ update_id: 1, update_type: 'message_created', timestamp: Date.now() }),
    });
}

const ORIGINAL_TOKEN = process.env.MAX_BOT_TOKEN;
const ORIGINAL_SECRET = process.env.MAX_WEBHOOK_SECRET;

describe('POST /api/max/webhook — подлинность источника', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.resetModules();
        process.env.MAX_BOT_TOKEN = 'test-token';
    });

    afterEach(() => {
        process.env.MAX_BOT_TOKEN = ORIGINAL_TOKEN;
        process.env.MAX_WEBHOOK_SECRET = ORIGINAL_SECRET;
    });

    it('секрет не задан (мисконфиг деплоя) — fail-open, апдейт обрабатывается', async () => {
        delete process.env.MAX_WEBHOOK_SECRET;
        const { POST } = await import('../src/app/api/max/webhook/route');

        const res = await POST(post() as any);

        expect(res.status).toBe(200);
        expect(handleMaxUpdate).toHaveBeenCalledTimes(1);
    });

    it('верный секрет в X-Max-Bot-Api-Secret — апдейт обрабатывается', async () => {
        process.env.MAX_WEBHOOK_SECRET = 'correct-secret-1234';
        const { POST } = await import('../src/app/api/max/webhook/route');

        const res = await POST(post({ 'x-max-bot-api-secret': 'correct-secret-1234' }) as any);

        expect(res.status).toBe(200);
        expect(handleMaxUpdate).toHaveBeenCalledTimes(1);
    });

    it('неверный секрет — апдейт отклоняется молча (200, но не обрабатывается)', async () => {
        process.env.MAX_WEBHOOK_SECRET = 'correct-secret-1234';
        const { POST } = await import('../src/app/api/max/webhook/route');

        const res = await POST(post({ 'x-max-bot-api-secret': 'wrong-secret' }) as any);

        expect(res.status).toBe(200);
        expect(handleMaxUpdate).not.toHaveBeenCalled();
    });

    it('заголовок отсутствует вовсе — апдейт отклоняется молча', async () => {
        process.env.MAX_WEBHOOK_SECRET = 'correct-secret-1234';
        const { POST } = await import('../src/app/api/max/webhook/route');

        const res = await POST(post() as any);

        expect(res.status).toBe(200);
        expect(handleMaxUpdate).not.toHaveBeenCalled();
    });
});
