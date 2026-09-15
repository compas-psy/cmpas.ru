// Task 2 correction: src/instrumentation.ts re-registers the MAX webhook
// subscription automatically ~10s after EVERY app startup — a path missed
// by the earlier Task 2 fix. It never sent MAX_WEBHOOK_SECRET at all, so on
// every restart it would silently re-register the subscription WITHOUT a
// secret, even after a deploy or the admin route had set one correctly —
// quietly undoing the fail-closed protection in
// src/app/api/max/webhook/route.ts. Also verifies the domain migration to
// platform-api2.max.ru.
//
// 15.09.2026 (Ф14, Ф15 книги «Витрина и машинное отделение»): постановка
// подписки переехала в src/lib/max/webhook.ts и стала идемпотентной. Раньше
// при каждом запуске сначала шёл DELETE, потом POST — и между ними было
// мгновение, в котором подписки не существовало; события этого мгновения
// терялись. Проверка на DELETE?url= заменена проверкой нового правила:
// существующую подписку не трогают, отсутствующую ставят. Требование
// «POST несёт secret» осталось нетронутым — оно и было смыслом этого файла.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('node-cron', () => ({ default: { schedule: vi.fn() }, schedule: vi.fn() }));
vi.mock('@/lib/cron/reminders', () => ({ processReminders: vi.fn() }));
vi.mock('@/lib/cron/digest', () => ({ processMorningDigest: vi.fn(), processWeeklyDigest: vi.fn() }));
vi.mock('@/lib/cron/post-session', () => ({ processPostSessionNudge: vi.fn() }));
vi.mock('@/lib/cron/post-session-cascade', () => ({ processNextBookingNudge: vi.fn(), processWeeklyFollowup: vi.fn() }));
vi.mock('@/lib/cron/scheduled-messages', () => ({ processScheduledMessages: vi.fn() }));
vi.mock('@/lib/cron/payment-reminders', () => ({ processPaymentReminders: vi.fn() }));
vi.mock('@/lib/cron/response-time', () => ({ flushResponseTimeWindow: vi.fn() }));
vi.mock('@/lib/cron/analytics-retention', () => ({ pruneOldAnalyticsEvents: vi.fn() }));
vi.mock('./lib/cron/reminders', () => ({ processReminders: vi.fn() }));
vi.mock('./lib/cron/digest', () => ({ processMorningDigest: vi.fn(), processWeeklyDigest: vi.fn() }));
vi.mock('./lib/cron/post-session', () => ({ processPostSessionNudge: vi.fn() }));
vi.mock('./lib/cron/post-session-cascade', () => ({ processNextBookingNudge: vi.fn(), processWeeklyFollowup: vi.fn() }));
vi.mock('./lib/cron/scheduled-messages', () => ({ processScheduledMessages: vi.fn() }));
vi.mock('./lib/cron/payment-reminders', () => ({ processPaymentReminders: vi.fn() }));
vi.mock('./lib/cron/response-time', () => ({ flushResponseTimeWindow: vi.fn() }));
vi.mock('./lib/cron/analytics-retention', () => ({ pruneOldAnalyticsEvents: vi.fn() }));

const ORIGINAL_ENV = { ...process.env };

/** Методы запросов по порядку. Отдельной функцией — её зовут три проверки. */
const callMethods = (mock: { mock: { calls: unknown[][] } }): Array<string | undefined> =>
    mock.mock.calls.map((call) => (call[1] as { method?: string } | undefined)?.method);

describe('instrumentation.ts — регистрация MAX webhook на старте', () => {
    let fetchMock: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        vi.resetModules();
        // Fake ONLY setTimeout/clearTimeout — faking Date too risks bleeding
        // into other test files' Date.now()-relative fixtures if this worker
        // reuses process state across files.
        vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
        process.env.NEXT_RUNTIME = 'nodejs';
        process.env.MAX_BOT_TOKEN = 'test-token';
        process.env.MAX_WEBHOOK_SECRET = 'webhook-secret-value';
        // Адрес вебхука собирается из AUTH_URL. Закрепляем его здесь, как и
        // остальные переменные: без этого тест читал бы окружение прогона —
        // локально AUTH_URL не задан и подставляется боевой домен, а в
        // веб-преflight стоит http://localhost:3000, потому что он нужен
        // сборке. Тест, ответ которого зависит от окружения, проверяет не
        // продукт, а окружение.
        process.env.AUTH_URL = 'https://cmpas.ru';
        fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true }) });
        vi.stubGlobal('fetch', fetchMock);
    });

    afterEach(() => {
        process.env = { ...ORIGINAL_ENV };
        vi.useRealTimers();
        vi.unstubAllGlobals();
    });

    it('POST /subscriptions на старте несёт "secret" — иначе каждый рестарт молча снимал бы защиту вебхука', async () => {
        const { register } = await import('../src/instrumentation');
        await register();
        await vi.advanceTimersByTimeAsync(10000);

        const postCall = fetchMock.mock.calls.find(
            (call) => (call[1] as { method?: string } | undefined)?.method === 'POST',
        ) as [string, { body: string }] | undefined;
        expect(postCall).toBeDefined();
        const [url, opts] = postCall!;
        expect(url).toBe('https://platform-api2.max.ru/subscriptions');
        const body = JSON.parse(opts.body);
        expect(body.secret).toBe('webhook-secret-value');
    });

    it('подписка сначала проверяется, а не снимается — в окне между DELETE и POST терялись события', async () => {
        const { register } = await import('../src/instrumentation');
        await register();
        await vi.advanceTimersByTimeAsync(10000);

        const methods = callMethods(fetchMock);
        expect(methods, 'снятие подписки вернулось').not.toContain('DELETE');
        expect(methods[0], 'постановка идёт до проверки').toBe('GET');
    });

    it('существующую подписку не переставляют', async () => {
        // Иначе каждый запуск и каждый тик сторожа — лишняя запись у
        // провайдера и лишний шанс остаться без подписки на ровном месте.
        fetchMock.mockImplementation(async (_url: string, opts?: { method?: string }) => {
            if (!opts || opts.method === 'GET') {
                return {
                    ok: true,
                    json: async () => ({ subscriptions: [{ url: 'https://cmpas.ru/api/max/webhook' }] }),
                };
            }
            return { ok: true, json: async () => ({ success: true }) };
        });

        const { register } = await import('../src/instrumentation');
        await register();
        await vi.advanceTimersByTimeAsync(10000);

        const methods = callMethods(fetchMock);
        expect(methods).toContain('GET');
        expect(methods).not.toContain('POST');
    });

    it('ни один вызов не идёт на устаревший botapi.max.ru', async () => {
        const { register } = await import('../src/instrumentation');
        await register();
        await vi.advanceTimersByTimeAsync(10000);

        const urls = fetchMock.mock.calls.map((call) => String(call[0]));
        expect(urls.length).toBeGreaterThan(0);
        expect(urls.every((u) => !u.includes('botapi.max.ru'))).toBe(true);
    });
});
