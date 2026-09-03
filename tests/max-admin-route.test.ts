// Task 2 correction (founder review, actual current MAX docs): единый base
// URL platform-api2.max.ru для всего MAX API (не только /subscriptions), и
// DELETE /subscriptions обязан передавать ?url=<удаляемая подписка> — без
// него запрос не идентифицирует, какую подписку снимать.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const ORIGINAL_TOKEN = process.env.MAX_BOT_TOKEN;
const ORIGINAL_SECRET = process.env.MAX_WEBHOOK_SECRET;
const ORIGINAL_ADMIN_SECRET = process.env.ADMIN_SECRET;

function req(url: string) {
    return { nextUrl: new URL(url) } as any;
}

describe('POST/GET /api/max/admin — единый platform-api2.max.ru, DELETE с ?url=', () => {
    let fetchMock: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        vi.resetModules();
        process.env.MAX_BOT_TOKEN = 'test-token';
        process.env.ADMIN_SECRET = 'admin-secret';
        process.env.MAX_WEBHOOK_SECRET = 'webhook-secret-value';
        fetchMock = vi.fn().mockImplementation((url: string) => {
            if (url.includes('DELETE') || true) {
                return Promise.resolve({ ok: true, json: async () => ({ success: true }) });
            }
        });
        vi.stubGlobal('fetch', fetchMock);
    });

    afterEach(() => {
        process.env.MAX_BOT_TOKEN = ORIGINAL_TOKEN;
        process.env.MAX_WEBHOOK_SECRET = ORIGINAL_SECRET;
        process.env.ADMIN_SECRET = ORIGINAL_ADMIN_SECRET;
        vi.unstubAllGlobals();
    });

    it('POST: DELETE идёт на platform-api2.max.ru/subscriptions?url=<webhook> — не голый DELETE без параметра', async () => {
        const { POST } = await import('../src/app/api/max/admin/route');
        await POST(req('https://cmpas.ru/api/max/admin?secret=admin-secret') as any);

        const deleteCall = fetchMock.mock.calls.find(([, opts]: any) => opts?.method === 'DELETE');
        expect(deleteCall).toBeDefined();
        const [deleteUrl] = deleteCall!;
        expect(deleteUrl).toMatch(/^https:\/\/platform-api2\.max\.ru\/subscriptions\?/);
        const parsed = new URL(deleteUrl);
        expect(parsed.searchParams.get('url')).toBe('https://cmpas.ru/api/max/webhook');
    });

    it('POST: регистрация (POST /subscriptions) тоже идёт на platform-api2.max.ru', async () => {
        const { POST } = await import('../src/app/api/max/admin/route');
        await POST(req('https://cmpas.ru/api/max/admin?secret=admin-secret') as any);

        const postCall = fetchMock.mock.calls.find(([, opts]: any) => opts?.method === 'POST');
        expect(postCall).toBeDefined();
        expect(postCall![0]).toBe('https://platform-api2.max.ru/subscriptions');
    });

    it('GET: /me и /subscriptions оба идут на platform-api2.max.ru (единый base URL)', async () => {
        const { GET } = await import('../src/app/api/max/admin/route');
        await GET(req('https://cmpas.ru/api/max/admin?secret=admin-secret') as any);

        const urls = fetchMock.mock.calls.map(([url]: any) => url);
        expect(urls.some((u: string) => u === 'https://platform-api2.max.ru/me')).toBe(true);
        expect(urls.some((u: string) => u === 'https://platform-api2.max.ru/subscriptions')).toBe(true);
        expect(urls.every((u: string) => !u.includes('botapi.max.ru'))).toBe(true);
    });

    it('GET: сообщает MAX_WEBHOOK_SECRET_set — preflight-диагностика конфигурации', async () => {
        const { GET } = await import('../src/app/api/max/admin/route');
        const res = await GET(req('https://cmpas.ru/api/max/admin?secret=admin-secret') as any);
        const body = await res.json();
        expect(body.MAX_WEBHOOK_SECRET_set).toBe(true);
    });

    it('GET: секрет не задан — configuration_error присутствует', async () => {
        delete process.env.MAX_WEBHOOK_SECRET;
        const { GET } = await import('../src/app/api/max/admin/route');
        const res = await GET(req('https://cmpas.ru/api/max/admin?secret=admin-secret') as any);
        const body = await res.json();
        expect(body.MAX_WEBHOOK_SECRET_set).toBe(false);
        expect(body.configuration_error).toBeTruthy();
    });
});
