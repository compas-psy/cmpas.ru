// Согласие как обычный аутентифицированный ресурс (решение учредителя 2):
// GET /api/mobile/analytics/consent отдаёт состояние, PUT меняет и
// применяется немедленно. Событие consent_updated пишет сервер сам, через
// существующий processIngestEvent — для журнала. Отзыв согласия (granted:
// false) удаляет AnalyticsEvent этого человека в одной транзакции со
// снятием согласия (решение 6) — но не трогает события чужих account_id и
// не сносит сам только что записанный журнальный consent_updated (иначе
// журнал отзыва исчезал бы вместе с отзываемыми данными).

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/mobile-auth', () => ({
    authenticateMobileRequest: async () => ({ userId: 'psy-1' }),
    unauthorizedResponse: () => new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
}));

interface StoredUser { id: string; analyticsConsentAt: Date | null }
interface EventRecord { id: string; event: string; accountId: string | null; deviceId: string | null; product: string; [key: string]: unknown }

const state: { users: Map<string, StoredUser>; events: EventRecord[] } = {
    users: new Map(),
    events: [],
};

function resetState() {
    state.users = new Map([
        ['psy-1', { id: 'psy-1', analyticsConsentAt: null }],
        ['psy-2', { id: 'psy-2', analyticsConsentAt: new Date('2026-08-01T00:00:00Z') }],
    ]);
    state.events = [
        { id: 'e1', event: 'app_opened', accountId: 'psy-1', deviceId: null, product: 'practice', ts: new Date(), props: {}, schemaVersion: 1 },
        { id: 'e2', event: 'session_created', accountId: 'psy-1', deviceId: null, product: 'practice', ts: new Date(), props: {}, schemaVersion: 1 },
        { id: 'e3', event: 'app_opened', accountId: 'psy-2', deviceId: null, product: 'practice', ts: new Date(), props: {}, schemaVersion: 1 },
    ];
}

vi.mock('@/lib/db', () => {
    const db = {
        user: {
            findUnique: async ({ where }: any) => state.users.get(where.id) ?? null,
            update: async ({ where, data }: any) => {
                const u = state.users.get(where.id);
                if (u) Object.assign(u, data);
                return u;
            },
        },
        analyticsEvent: {
            create: async ({ data }: any) => {
                const row = { id: `e${state.events.length + 1}`, ...data };
                state.events.push(row);
                return row;
            },
            findUnique: async ({ where }: any) => state.events.find((e) => (e as any).eventId === where.eventId) ?? null,
            deleteMany: async ({ where }: any) => {
                const before = state.events.length;
                state.events = state.events.filter((e) => !(e.accountId === where.accountId && e.product === where.product));
                return { count: before - state.events.length };
            },
        },
        analyticsEventRejected: { create: async () => ({}) },
        analyticsDeviceConsent: {
            findUnique: async () => null,
            upsert: async ({ create }: any) => create,
        },
        $transaction: async (fn: any) => fn(db),
    };
    return { db };
});

async function importRoute() {
    return import('../src/app/api/mobile/analytics/consent/route');
}

function req(method: string, body?: unknown): Request {
    return new Request('https://cmpas.ru/api/mobile/analytics/consent', {
        method,
        headers: { 'content-type': 'application/json', authorization: 'Bearer whatever' },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
}

describe('GET/PUT /api/mobile/analytics/consent', () => {
    beforeEach(() => {
        resetState();
        vi.resetModules();
    });

    it('GET отдаёт granted:false, since:null, когда согласия нет', async () => {
        const { GET } = await importRoute();
        const res = await GET(req('GET') as any);
        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({ granted: false, since: null });
    });

    it('GET отдаёт granted:true и since из analyticsConsentAt, когда согласие есть', async () => {
        state.users.set('psy-1', { id: 'psy-1', analyticsConsentAt: new Date('2026-08-10T00:00:00Z') });
        const { GET } = await importRoute();
        const res = await GET(req('GET') as any);
        const body = await res.json();
        expect(body.granted).toBe(true);
        expect(body.since).toBe('2026-08-10T00:00:00.000Z');
    });

    it('PUT granted:true применяется немедленно и сам пишет consent_updated в журнал', async () => {
        const { PUT } = await importRoute();
        const res = await PUT(req('PUT', { granted: true }) as any);
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.granted).toBe(true);
        expect(state.users.get('psy-1')?.analyticsConsentAt).not.toBeNull();
        expect(state.events.some((e) => e.event === 'consent_updated' && e.accountId === 'psy-1')).toBe(true);
    });

    it('PUT granted:false удаляет AnalyticsEvent этого человека, но не трогает чужие', async () => {
        state.users.set('psy-1', { id: 'psy-1', analyticsConsentAt: new Date('2026-08-01T00:00:00Z') });
        const { PUT } = await importRoute();
        const res = await PUT(req('PUT', { granted: false }) as any);
        expect(res.status).toBe(200);

        const remainingForPsy1 = state.events.filter((e) => e.accountId === 'psy-1');
        // Поведенческие события удалены; консент сам сервер пишет для
        // журнала — эта запись остаётся (иначе журнал отзыва пропадал бы
        // вместе с отзываемыми данными).
        expect(remainingForPsy1.filter((e) => e.event !== 'consent_updated')).toHaveLength(0);
        expect(remainingForPsy1.some((e) => e.event === 'consent_updated')).toBe(true);

        const remainingForPsy2 = state.events.filter((e) => e.accountId === 'psy-2');
        expect(remainingForPsy2).toHaveLength(1);
        expect(remainingForPsy2[0].event).toBe('app_opened');
    });

    it('PUT granted:false снимает согласие (analyticsConsentAt становится null)', async () => {
        state.users.set('psy-1', { id: 'psy-1', analyticsConsentAt: new Date('2026-08-01T00:00:00Z') });
        const { PUT } = await importRoute();
        await PUT(req('PUT', { granted: false }) as any);
        expect(state.users.get('psy-1')?.analyticsConsentAt).toBeNull();
    });

    it('PUT без boolean granted — 400, ничего не меняется', async () => {
        const before = state.events.length;
        const { PUT } = await importRoute();
        const res = await PUT(req('PUT', {}) as any);
        expect(res.status).toBe(400);
        expect(state.events.length).toBe(before);
    });

    it('без токена — 401', async () => {
        const mobileAuth = await import('@/lib/mobile-auth');
        vi.spyOn(mobileAuth, 'authenticateMobileRequest').mockResolvedValueOnce(null);
        const { GET } = await importRoute();
        const res = await GET(req('GET') as any);
        expect(res.status).toBe(401);
    });
});
