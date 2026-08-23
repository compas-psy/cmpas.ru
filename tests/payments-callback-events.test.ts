// B4: приборы для событий денег в POST /api/payments/callback —
// payment_succeeded, payment_failed, subscription_started/renewed,
// subscription_churned. Тот же колбэк, что и B1 (tests/
// payments-callback-subscription.test.ts) — здесь только сами события.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createHash } from 'crypto';

const SITE_KEY = '1775405621806DEMO';
const SITE_PASSWORD = 'MwTygrFgyCLUQcFu';

function tinkoffToken(params: Record<string, unknown>, password: string): string {
    const signable: Record<string, string> = { Password: password };
    for (const [k, v] of Object.entries(params)) {
        if (k === 'Token') continue;
        if (v !== null && v !== undefined && typeof v !== 'object' && typeof v !== 'function') {
            signable[k] = String(v);
        }
    }
    const sortedValues = Object.keys(signable).sort().map((k) => signable[k]).join('');
    return createHash('sha256').update(sortedValues, 'utf8').digest('hex');
}

function notification(overrides: Record<string, unknown> = {}) {
    const base = {
        TerminalKey: SITE_KEY,
        OrderId: 'order_1',
        Success: true,
        Status: 'CONFIRMED',
        PaymentId: 555,
        Amount: 99000,
        ...overrides,
    };
    return { ...base, Token: tinkoffToken(base, SITE_PASSWORD) };
}

function req(notif: Record<string, unknown>): Request {
    const body = new URLSearchParams();
    for (const [k, v] of Object.entries(notif)) body.set(k, String(v));
    return new Request('https://cmpas.ru/api/payments/callback', {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
    }) as unknown as Request;
}

const recordSubscriptionPayment = vi.fn();
vi.mock('@/lib/analytics/subscription', () => ({
    recordSubscriptionPayment: (...args: unknown[]) => recordSubscriptionPayment(...args),
}));

const track = vi.fn();
vi.mock('@/lib/analytics/track', () => ({
    track: (...args: unknown[]) => track(...args),
}));

interface StoredPayment {
    id: string;
    orderId: string;
    userId: string;
    status: string;
    plan: string;
    months: number;
    amount: number;
    terminal: string;
}
interface StoredUser {
    id: string;
    subscriptionEndsAt: Date | null;
    subscriptionPlan: string | null;
}

function makeDb(payment: StoredPayment | null, user: StoredUser | null) {
    let currentPayment = payment;
    let currentUser = user;
    const db = {
        payment: {
            findUnique: vi.fn(async () => currentPayment),
            update: vi.fn(async ({ data }: { data: Partial<StoredPayment> }) => {
                if (currentPayment) currentPayment = { ...currentPayment, ...data } as StoredPayment;
                return currentPayment;
            }),
        },
        user: {
            findUnique: vi.fn(async () => currentUser),
            update: vi.fn(async ({ data }: { data: Partial<StoredUser> }) => {
                if (currentUser) currentUser = { ...currentUser, ...data } as StoredUser;
                return currentUser;
            }),
        },
    };
    return { db };
}

let currentDb: ReturnType<typeof makeDb>['db'];
vi.mock('@/lib/db', () => ({ get db() { return currentDb; } }));

const ORIGINAL_ENV = { ...process.env };

describe('POST /api/payments/callback — события денег (B4)', () => {
    beforeEach(() => {
        vi.resetModules();
        recordSubscriptionPayment.mockReset().mockResolvedValue(undefined);
        track.mockReset().mockResolvedValue(undefined);
        process.env = { ...ORIGINAL_ENV };
        delete process.env.TINKOFF_TERMINAL_KEY;
        delete process.env.TINKOFF_PASSWORD;
        delete process.env.TINKOFF_APP_TERMINAL_KEY;
        delete process.env.TINKOFF_APP_PASSWORD;
    });
    afterEach(() => {
        process.env = { ...ORIGINAL_ENV };
    });

    it('первый платёж (не было активной подписки) — payment_succeeded и subscription_started, не renewed', async () => {
        currentDb = makeDb(
            { id: 'pay_1', orderId: 'order_1', userId: 'user_1', status: 'pending', plan: 'practice', months: 1, amount: 99000, terminal: 'site' },
            { id: 'user_1', subscriptionEndsAt: null, subscriptionPlan: null },
        ).db;

        const { POST } = await import('../src/app/api/payments/callback/route');
        await POST(req(notification()) as any);

        const events = track.mock.calls.map((c) => (c[1] as { event: string }).event);
        expect(events).toContain('payment_succeeded');
        expect(events).toContain('subscription_started');
        expect(events).not.toContain('subscription_renewed');

        const succeeded = track.mock.calls.find((c) => (c[1] as { event: string }).event === 'payment_succeeded')![1] as any;
        expect(succeeded).toMatchObject({
            product: 'practice',
            accountId: 'user_1',
            props: { terminal: 'site', plan: 'practice', amount: 99000, months: 1 },
        });
    });

    it('продление активной подписки — subscription_renewed, не started', async () => {
        currentDb = makeDb(
            { id: 'pay_1', orderId: 'order_1', userId: 'user_1', status: 'pending', plan: 'practice', months: 1, amount: 99000, terminal: 'site' },
            { id: 'user_1', subscriptionEndsAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000), subscriptionPlan: 'practice' },
        ).db;

        const { POST } = await import('../src/app/api/payments/callback/route');
        await POST(req(notification()) as any);

        const events = track.mock.calls.map((c) => (c[1] as { event: string }).event);
        expect(events).toContain('subscription_renewed');
        expect(events).not.toContain('subscription_started');
    });

    it('повторный webhook для уже paid платежа — ни payment_succeeded, ни subscription_* не отправляются повторно', async () => {
        currentDb = makeDb(
            { id: 'pay_1', orderId: 'order_1', userId: 'user_1', status: 'paid', plan: 'practice', months: 1, amount: 99000, terminal: 'site' },
            { id: 'user_1', subscriptionEndsAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000), subscriptionPlan: 'practice' },
        ).db;

        const { POST } = await import('../src/app/api/payments/callback/route');
        await POST(req(notification()) as any);

        expect(track).not.toHaveBeenCalled();
    });

    it('отклонённый банком платёж — payment_failed с reason из статуса банка', async () => {
        currentDb = makeDb(
            { id: 'pay_1', orderId: 'order_1', userId: 'user_1', status: 'pending', plan: 'practice', months: 1, amount: 99000, terminal: 'site' },
            { id: 'user_1', subscriptionEndsAt: null, subscriptionPlan: null },
        ).db;

        const { POST } = await import('../src/app/api/payments/callback/route');
        await POST(req(notification({ Status: 'REJECTED' })) as any);

        const events = track.mock.calls.map((c) => (c[1] as { event: string }).event);
        expect(events).toEqual(['payment_failed']);
        const failed = track.mock.calls[0][1] as any;
        expect(failed.props).toMatchObject({ terminal: 'site', plan: 'practice', reason: 'REJECTED' });
    });

    it('возврат ранее оплаченного платежа (REVERSED) — subscription_churned', async () => {
        currentDb = makeDb(
            { id: 'pay_1', orderId: 'order_1', userId: 'user_1', status: 'paid', plan: 'practice', months: 1, amount: 99000, terminal: 'site' },
            { id: 'user_1', subscriptionEndsAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000), subscriptionPlan: 'practice' },
        ).db;

        const { POST } = await import('../src/app/api/payments/callback/route');
        await POST(req(notification({ Status: 'REVERSED' })) as any);

        const events = track.mock.calls.map((c) => (c[1] as { event: string }).event);
        expect(events).toEqual(['subscription_churned']);
    });
});

// Гарантия "падение аналитики не роняет запрос" (задача B4) держится внутри
// track() самой (try/catch на processIngestEvent, см.
// tests/analytics-track.test.ts, тест "ошибка транспорта... проглатывается")
// — колбэк платежа полагается на этот контракт и не дублирует try/catch на
// своей стороне, поэтому здесь не мокается падение track(): мок в этом
// файле — это сама функция, а не её внутренности, и её реальное поведение
// проверяется отдельно.
