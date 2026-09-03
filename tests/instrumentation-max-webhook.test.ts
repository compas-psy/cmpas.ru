// Task 2 correction: src/instrumentation.ts re-registers the MAX webhook
// subscription automatically ~10s after EVERY app startup — a path missed
// by the earlier Task 2 fix. It never sent MAX_WEBHOOK_SECRET at all, so on
// every restart it would silently re-register the subscription WITHOUT a
// secret, even after a deploy or the admin route had set one correctly —
// quietly undoing the fail-closed protection in
// src/app/api/max/webhook/route.ts. Also verifies the domain migration to
// platform-api2.max.ru and the DELETE ?url= requirement.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('node-cron', () => ({ default: { schedule: vi.fn() }, schedule: vi.fn() }));
vi.mock('@/lib/cron/reminders', () => ({ processReminders: vi.fn() }));
vi.mock('@/lib/cron/digest', () => ({ processMorningDigest: vi.fn(), processWeeklyDigest: vi.fn() }));
vi.mock('@/lib/cron/post-session', () => ({ processPostSessionNudge: vi.fn() }));
vi.mock('@/lib/cron/post-session-cascade', () => ({ processNextBookingNudge: vi.fn(), processWeeklyFollowup: vi.fn() }));
vi.mock('@/lib/cron/scheduled-messages', () => ({ processScheduledMessages: vi.fn() }));
vi.mock('@/lib/cron/response-time', () => ({ flushResponseTimeWindow: vi.fn() }));
vi.mock('@/lib/cron/analytics-retention', () => ({ pruneOldAnalyticsEvents: vi.fn() }));
vi.mock('./lib/cron/reminders', () => ({ processReminders: vi.fn() }));
vi.mock('./lib/cron/digest', () => ({ processMorningDigest: vi.fn(), processWeeklyDigest: vi.fn() }));
vi.mock('./lib/cron/post-session', () => ({ processPostSessionNudge: vi.fn() }));
vi.mock('./lib/cron/post-session-cascade', () => ({ processNextBookingNudge: vi.fn(), processWeeklyFollowup: vi.fn() }));
vi.mock('./lib/cron/scheduled-messages', () => ({ processScheduledMessages: vi.fn() }));
vi.mock('./lib/cron/response-time', () => ({ flushResponseTimeWindow: vi.fn() }));
vi.mock('./lib/cron/analytics-retention', () => ({ pruneOldAnalyticsEvents: vi.fn() }));

const ORIGINAL_ENV = { ...process.env };

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

        const postCall = fetchMock.mock.calls.find(([, opts]: any) => opts?.method === 'POST');
        expect(postCall).toBeDefined();
        const [url, opts] = postCall!;
        expect(url).toBe('https://platform-api2.max.ru/subscriptions');
        const body = JSON.parse(opts.body);
        expect(body.secret).toBe('webhook-secret-value');
    });

    it('DELETE на старте передаёт ?url= удаляемой подписки, на platform-api2.max.ru', async () => {
        const { register } = await import('../src/instrumentation');
        await register();
        await vi.advanceTimersByTimeAsync(10000);

        const deleteCall = fetchMock.mock.calls.find(([, opts]: any) => opts?.method === 'DELETE');
        expect(deleteCall).toBeDefined();
        const [url] = deleteCall!;
        expect(url.startsWith('https://platform-api2.max.ru/subscriptions?')).toBe(true);
        expect(new URL(url).searchParams.get('url')).toBe('https://cmpas.ru/api/max/webhook');
    });

    it('ни один вызов не идёт на устаревший botapi.max.ru', async () => {
        const { register } = await import('../src/instrumentation');
        await register();
        await vi.advanceTimersByTimeAsync(10000);

        const urls = fetchMock.mock.calls.map(([url]: any) => url as string);
        expect(urls.length).toBeGreaterThan(0);
        expect(urls.every((u) => !u.includes('botapi.max.ru'))).toBe(true);
    });
});
