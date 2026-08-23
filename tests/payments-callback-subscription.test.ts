// Ф0/§5 charter/13_TRACKING_PLAN.md: запись Subscription для MRR раньше
// происходила только за флагом ANALYTICS_TRACKING_ENABLED (по умолчанию
// false, src/lib/analytics/flags.ts) внутри POST /api/payments/callback —
// то есть таблица Subscription не заполнялась вовсе, пока флаг не включат
// вручную, и панель «Деньги»/«Удержание» считала по пустой таблице.
// Флаг предназначен для поведенческой аналитики (см. src/lib/analytics/
// flags.ts), а не для учётной записи о деньгах: запись Subscription должна
// происходить при каждом успешном платеже независимо от него.

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

const recordSubscriptionPayment = vi.fn();
vi.mock('@/lib/analytics/subscription', () => ({
    recordSubscriptionPayment: (...args: unknown[]) => recordSubscriptionPayment(...args),
}));

interface StoredPayment {
    id: string;
    orderId: string;
    userId: string;
    status: string;
    plan: string;
    months: number;
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
    return { db, getUser: () => currentUser, getPayment: () => currentPayment };
}

let currentDb: ReturnType<typeof makeDb>['db'];
vi.mock('@/lib/db', () => ({ get db() { return currentDb; } }));

const ORIGINAL_ENV = { ...process.env };

function req(notif: Record<string, unknown>): Request {
    const body = new URLSearchParams();
    for (const [k, v] of Object.entries(notif)) body.set(k, String(v));
    return new Request('https://cmpas.ru/api/payments/callback', {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
    }) as unknown as Request;
}

describe('POST /api/payments/callback — запись Subscription не зависит от ANALYTICS_TRACKING_ENABLED (13_TRACKING_PLAN.md §5)', () => {
    beforeEach(() => {
        vi.resetModules();
        recordSubscriptionPayment.mockReset();
        recordSubscriptionPayment.mockResolvedValue(undefined);
        process.env = { ...ORIGINAL_ENV };
        delete process.env.TINKOFF_TERMINAL_KEY;
        delete process.env.TINKOFF_PASSWORD;
        delete process.env.TINKOFF_APP_TERMINAL_KEY;
        delete process.env.TINKOFF_APP_PASSWORD;
    });
    afterEach(() => {
        process.env = { ...ORIGINAL_ENV };
    });

    it('успешный платёж пишет Subscription даже при ANALYTICS_TRACKING_ENABLED=false', async () => {
        process.env.ANALYTICS_TRACKING_ENABLED = 'false';
        const { db } = makeDb(
            { id: 'pay_1', orderId: 'order_1', userId: 'user_1', status: 'pending', plan: 'practice', months: 1, terminal: 'site' },
            { id: 'user_1', subscriptionEndsAt: null, subscriptionPlan: null },
        );
        currentDb = db;

        const { POST } = await import('../src/app/api/payments/callback/route');
        const res = await POST(req(notification()) as any);

        expect(await res.text()).toBe('OK');
        expect(recordSubscriptionPayment).toHaveBeenCalledTimes(1);
        expect(recordSubscriptionPayment).toHaveBeenCalledWith(
            db,
            expect.objectContaining({ userId: 'user_1', plan: 'practice', months: 1, terminal: 'site' }),
        );
    });

    it('успешный платёж пишет Subscription и при ANALYTICS_TRACKING_ENABLED=true (поведение не ломается)', async () => {
        process.env.ANALYTICS_TRACKING_ENABLED = 'true';
        const { db } = makeDb(
            { id: 'pay_1', orderId: 'order_1', userId: 'user_1', status: 'pending', plan: 'practice', months: 1, terminal: 'site' },
            { id: 'user_1', subscriptionEndsAt: null, subscriptionPlan: null },
        );
        currentDb = db;

        const { POST } = await import('../src/app/api/payments/callback/route');
        await POST(req(notification()) as any);

        expect(recordSubscriptionPayment).toHaveBeenCalledTimes(1);
    });

    it('без флага вовсе (переменная не задана) — тоже пишет Subscription', async () => {
        delete process.env.ANALYTICS_TRACKING_ENABLED;
        const { db } = makeDb(
            { id: 'pay_1', orderId: 'order_1', userId: 'user_1', status: 'pending', plan: 'practice', months: 1, terminal: 'site' },
            { id: 'user_1', subscriptionEndsAt: null, subscriptionPlan: null },
        );
        currentDb = db;

        const { POST } = await import('../src/app/api/payments/callback/route');
        await POST(req(notification()) as any);

        expect(recordSubscriptionPayment).toHaveBeenCalledTimes(1);
    });

    it('платёж уже был paid (повторный webhook) — Subscription не пишется повторно', async () => {
        process.env.ANALYTICS_TRACKING_ENABLED = 'false';
        const { db } = makeDb(
            { id: 'pay_1', orderId: 'order_1', userId: 'user_1', status: 'paid', plan: 'practice', months: 1, terminal: 'site' },
            { id: 'user_1', subscriptionEndsAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000), subscriptionPlan: 'practice' },
        );
        currentDb = db;

        const { POST } = await import('../src/app/api/payments/callback/route');
        await POST(req(notification()) as any);

        expect(recordSubscriptionPayment).not.toHaveBeenCalled();
    });

    it('rebillId и пароль терминала не попадают в вызов recordSubscriptionPayment (13_TRACKING_PLAN.md рубеж)', async () => {
        process.env.ANALYTICS_TRACKING_ENABLED = 'false';
        const { db } = makeDb(
            { id: 'pay_1', orderId: 'order_1', userId: 'user_1', status: 'pending', plan: 'practice', months: 1, terminal: 'site' },
            { id: 'user_1', subscriptionEndsAt: null, subscriptionPlan: null },
        );
        currentDb = db;

        const { POST } = await import('../src/app/api/payments/callback/route');
        await POST(req(notification({ RebillId: 123456789 })) as any);

        const call = recordSubscriptionPayment.mock.calls[0][1];
        expect(JSON.stringify(call)).not.toMatch(/rebill/i);
        expect(JSON.stringify(call)).not.toMatch(/password/i);
    });
});
