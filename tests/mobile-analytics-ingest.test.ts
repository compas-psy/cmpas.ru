// POST /api/mobile/analytics (решение учредителя 3): приложение шлёт сюда
// обычным пользовательским JWT — секрет ANALYTICS_INGEST_SECRET_* в APK не
// кладём. Сервер сам подставляет product:'practice' и account_id =
// auth.userId; device_id приложение не отправляет вовсе (решение 4) — эта
// точка обязана его игнорировать, даже если тело его всё-таки содержит.
//
// Вторая линия защиты (fail-closed, решение учредителя): без согласия
// (User.analyticsConsentAt) события не пишутся вовсе — ветка practice
// приёмника (writeAccountEvent в src/lib/analytics/ingest.ts) сегодня
// пишет и без согласия; эта точка обязана отказывать раньше, чем дело
// дойдёт до неё.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const AUTH_USER_ID = 'psy-1';

vi.mock('@/lib/mobile-auth', () => ({
    authenticateMobileRequest: async () => ({ userId: AUTH_USER_ID }),
    unauthorizedResponse: () => new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
}));

interface StoredUser { id: string; analyticsConsentAt: Date | null }
interface EventRecord { event: string; accountId: string | null; deviceId: string | null; product: string; eventId?: string | null; [key: string]: unknown }

const state: { users: Map<string, StoredUser>; events: EventRecord[]; rejected: unknown[] } = {
    users: new Map(),
    events: [],
    rejected: [],
};

function resetState(consentAt: Date | null) {
    state.users = new Map([[AUTH_USER_ID, { id: AUTH_USER_ID, analyticsConsentAt: consentAt }]]);
    state.events = [];
    state.rejected = [];
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
            create: async ({ data }: any) => { state.events.push(data); return data; },
            findUnique: async ({ where }: any) => state.events.find((e) => e.eventId === where.eventId) ?? null,
            deleteMany: async () => ({ count: 0 }),
        },
        analyticsEventRejected: { create: async ({ data }: any) => { state.rejected.push(data); return data; } },
        analyticsDeviceConsent: { findUnique: async () => null, upsert: async ({ create }: any) => create },
    };
    return { db };
});

async function importRoute() {
    return import('../src/app/api/mobile/analytics/route');
}

function req(body: unknown): Request {
    return new Request('https://cmpas.ru/api/mobile/analytics', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: 'Bearer whatever' },
        body: JSON.stringify(body),
    });
}

function appOpened(overrides: Record<string, unknown> = {}) {
    return {
        event: 'app_opened',
        ts: new Date().toISOString(),
        schema_version: 1,
        props: { surface: 'android' },
        ...overrides,
    };
}

describe('POST /api/mobile/analytics', () => {
    beforeEach(() => {
        vi.resetModules();
    });

    it('без согласия — ни одно событие не пишется, ответ явно говорит о причине', async () => {
        resetState(null);
        const { POST } = await importRoute();
        const res = await POST(req([appOpened()]) as any);
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.results).toHaveLength(1);
        expect(body.results[0].accepted).toBe(false);
        expect(body.results[0].reason).toMatch(/consent/i);
        expect(state.events).toHaveLength(0);
    });

    it('с согласием — событие пишется', async () => {
        resetState(new Date('2026-08-01T00:00:00Z'));
        const { POST } = await importRoute();
        const res = await POST(req([appOpened()]) as any);
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.results[0].accepted).toBe(true);
        expect(state.events).toHaveLength(1);
        expect(state.events[0].event).toBe('app_opened');
        expect(state.events[0].accountId).toBe(AUTH_USER_ID);
        expect(state.events[0].product).toBe('practice');
    });

    it('device_id приложение не отправляет — даже если тело его содержит, сервер игнорирует и пишет null', async () => {
        resetState(new Date('2026-08-01T00:00:00Z'));
        const { POST } = await importRoute();
        await POST(req([appOpened({ device_id: 'sneaky-device' })]) as any);
        expect(state.events[0].deviceId).toBeNull();
    });

    it('чужой account_id подставить нельзя: даже если тело его содержит, сервер использует auth.userId', async () => {
        resetState(new Date('2026-08-01T00:00:00Z'));
        const { POST } = await importRoute();
        await POST(req([appOpened({ account_id: 'someone-elses-id' })]) as any);
        expect(state.events[0].accountId).toBe(AUTH_USER_ID);
    });

    it('несколько событий в пачке обрабатываются поштучно, ответ — массив в том же порядке', async () => {
        resetState(new Date('2026-08-01T00:00:00Z'));
        const { POST } = await importRoute();
        const res = await POST(req([
            appOpened(),
            { event: 'session_note_abandoned', ts: new Date().toISOString(), schema_version: 1, props: { surface: 'android', had_input: false } },
        ]) as any);
        const body = await res.json();
        expect(body.results).toHaveLength(2);
        expect(body.results.every((r: any) => r.accepted)).toBe(true);
        expect(state.events.map((e) => e.event)).toEqual(['app_opened', 'session_note_abandoned']);
    });

    it('consent_updated нельзя протащить через этот маршрут — только через PUT /api/mobile/analytics/consent', async () => {
        resetState(new Date('2026-08-01T00:00:00Z'));
        const { POST } = await importRoute();
        const res = await POST(req([{ event: 'consent_updated', ts: new Date().toISOString(), schema_version: 1, props: { granted: false } }]) as any);
        const body = await res.json();
        expect(body.results[0].accepted).toBe(false);
        expect(state.events).toHaveLength(0);
        // и главное: analyticsConsentAt не тронут этим путём
        expect(state.users.get(AUTH_USER_ID)?.analyticsConsentAt).not.toBeNull();
    });

    it('невалидное событие (неизвестный prop) отвергается как обычно, с согласием на файле', async () => {
        resetState(new Date('2026-08-01T00:00:00Z'));
        const { POST } = await importRoute();
        const res = await POST(req([appOpened({ props: { surface: 'android', made_up_prop: 'x' } })]) as any);
        const body = await res.json();
        expect(body.results[0].accepted).toBe(false);
        expect(state.events).toHaveLength(0);
    });

    it('тело не массив — 400', async () => {
        resetState(new Date('2026-08-01T00:00:00Z'));
        const { POST } = await importRoute();
        const res = await POST(req(appOpened()) as any);
        expect(res.status).toBe(400);
    });

    it('пачка больше 200 — 400, без обработки', async () => {
        resetState(new Date('2026-08-01T00:00:00Z'));
        const { POST } = await importRoute();
        const events = Array.from({ length: 201 }, () => appOpened());
        const res = await POST(req(events) as any);
        expect(res.status).toBe(400);
        expect(state.events).toHaveLength(0);
    });

    it('без токена — 401', async () => {
        resetState(new Date('2026-08-01T00:00:00Z'));
        const mobileAuth = await import('@/lib/mobile-auth');
        vi.spyOn(mobileAuth, 'authenticateMobileRequest').mockResolvedValueOnce(null);
        const { POST } = await importRoute();
        const res = await POST(req([appOpened()]) as any);
        expect(res.status).toBe(401);
    });
});
