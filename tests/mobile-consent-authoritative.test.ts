// Отзыв согласия обязан быть авторитетным, а не побочным эффектом записи события.
//
// Было так: PUT удалял события и вызывал processIngestEvent, который САМ по
// пути обнулял User.analyticsConsentAt. Но processIngestEvent при отказе
// (например, по ограничению частоты — счётчик общий с обычной отправкой
// событий, 600 за 60 секунд на аккаунт) возвращает отказ ЗНАЧЕНИЕМ, не
// исключением. Транзакция не откатывалась, и получалось худшее из возможного:
// события уже удалены, согласие НЕ снято, журнальной записи нет, а клиенту
// отвечено «отозвано».
//
// Последствия были не косметические: приложение кэшировало «согласия нет» и
// чистило свою очередь, а сервер продолжал считать согласие действующим и
// принимать события. Текст тумблера («сбор прекращается») в этом случае был
// ложью, и обещанная «запись о самом отключении» тоже отсутствовала.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const state = {
    user: { id: 'psy-1', analyticsConsentAt: new Date('2026-08-01T00:00:00Z') } as { id: string; analyticsConsentAt: Date | null },
    events: [] as any[],
    deletedFor: [] as string[],
    ingestAccepts: true,
};

vi.mock('@/lib/mobile-auth', () => ({
    authenticateMobileRequest: async () => ({ userId: 'psy-1' }),
    unauthorizedResponse: () => new Response('unauthorized', { status: 401 }),
}));

vi.mock('@/lib/analytics/ingest', () => ({
    // Приёмник отвечает отказом ЗНАЧЕНИЕМ, как настоящий при ограничении частоты.
    processIngestEvent: async () =>
        state.ingestAccepts ? { accepted: true } : { accepted: false, reason: 'rate limited' },
    MAX_INGEST_BATCH_SIZE: 200,
}));

vi.mock('@/lib/db', () => {
    const tx = {
        analyticsEvent: {
            deleteMany: async ({ where }: any) => { state.deletedFor.push(where.accountId); return { count: 1 }; },
        },
        user: {
            findUnique: async () => state.user,
            update: async ({ data }: any) => {
                state.user = { ...state.user, ...data };
                return state.user;
            },
        },
    };
    return { db: { ...tx, $transaction: async (fn: any) => fn(tx) } };
});

beforeEach(() => {
    state.user = { id: 'psy-1', analyticsConsentAt: new Date('2026-08-01T00:00:00Z') };
    state.deletedFor = [];
    state.ingestAccepts = true;
    vi.resetModules();
});

function put(granted: boolean) {
    return new Request('https://cmpas.ru/api/mobile/analytics/consent', {
        method: 'PUT',
        headers: { 'content-type': 'application/json', authorization: 'Bearer token' },
        body: JSON.stringify({ granted }),
    });
}

describe('PUT /api/mobile/analytics/consent — авторитетность', () => {
    it('отзыв снимает согласие ДАЖЕ если журнальная запись отвергнута', async () => {
        state.ingestAccepts = false;
        const { PUT } = await import('../src/app/api/mobile/analytics/consent/route');

        const res = await PUT(put(false) as any);

        expect(state.deletedFor).toEqual(['psy-1']);
        expect(
            state.user.analyticsConsentAt,
            'события удалены, а согласие осталось — сбор продолжится, и тумблер соврал',
        ).toBeNull();
        expect((await res.json()).granted).toBe(false);
        expect(res.status).toBe(200);
    });

    it('выдача согласия ставит отметку даже при отвергнутой журнальной записи', async () => {
        state.ingestAccepts = false;
        state.user.analyticsConsentAt = null;
        const { PUT } = await import('../src/app/api/mobile/analytics/consent/route');

        await PUT(put(true) as any);

        expect(state.user.analyticsConsentAt).not.toBeNull();
    });

    it('ответ отражает фактическое состояние, а не то, что попросил клиент', async () => {
        const { PUT, GET } = await import('../src/app/api/mobile/analytics/consent/route');
        await PUT(put(false) as any);
        const after = await (await GET(new Request('https://cmpas.ru/x', {
            headers: { authorization: 'Bearer token' },
        }) as any)).json();
        expect(after.granted).toBe(false);
        expect(after.since).toBeNull();
    });

    it('при выдаче согласия события не удаляются', async () => {
        state.user.analyticsConsentAt = null;
        const { PUT } = await import('../src/app/api/mobile/analytics/consent/route');
        await PUT(put(true) as any);
        expect(state.deletedFor).toEqual([]);
    });
});
