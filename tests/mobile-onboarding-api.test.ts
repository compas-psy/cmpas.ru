// Задача 24: приложение получает то же состояние онбординга, что и веб, и
// сообщает ровно о двух действиях человека.
//
// Ресурс намеренно узкий: он принимает ИМЯ состоявшегося действия, а не
// готовое состояние. Шаги «клиенты», «расписание» и «запись» вычисляются из
// данных практики, и отметить их снаружи нельзя — ни отсюда, ни откуда-либо
// ещё. Иначе чек-лист снова стал бы набором флагов, которые можно проставить,
// ничего не сделав.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const world = vi.hoisted(() => ({
    clients: 0,
    slots: 0,
    sessions: 0,
    settings: null as { bookingLinkSharedAt: Date | null; onboardingDismissedAt: Date | null; timezone: string } | null,
    upserts: [] as Array<Record<string, unknown>>,
    authUserId: 'psy-1' as string | null,
}));

vi.mock('@/lib/mobile-auth', () => ({
    authenticateMobileRequest: vi.fn(async () => (world.authUserId ? { userId: world.authUserId } : null)),
    unauthorizedResponse: () => new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
}));

vi.mock('@/lib/db', () => ({
    db: {
        diaryClient: { count: vi.fn(async () => world.clients) },
        availabilitySlot: { count: vi.fn(async () => world.slots) },
        scheduleRule: { count: vi.fn(async () => 0) },
        // Ближайшие встречи читаются парой (день, время): «сегодня в 10:00»
        // в шесть вечера уже не будущая — см. tests/practice-onboarding.test.ts.
        diarySession: {
            count: vi.fn(async () => world.sessions),
            findMany: vi.fn(async () => []),
        },
        psychologistSettings: {
            findUnique: vi.fn(async () => world.settings),
            upsert: vi.fn(async ({ update }: { update: Record<string, unknown> }) => {
                world.upserts.push(update);
                Object.assign(world.settings!, update);
                return world.settings;
            }),
        },
    },
}));

const onboarding = await import('@/app/api/mobile/onboarding/route');

function request(body?: unknown) {
    return { json: async () => body } as never;
}

beforeEach(() => {
    world.clients = 0;
    world.slots = 0;
    world.sessions = 0;
    world.settings = { bookingLinkSharedAt: null, onboardingDismissedAt: null, timezone: 'Europe/Moscow' };
    world.upserts = [];
    world.authUserId = 'psy-1';
});

describe('GET /api/mobile/onboarding', () => {
    it('без авторизации не отвечает', async () => {
        world.authUserId = null;

        expect((await onboarding.GET(request())).status).toBe(401);
    });

    it('отдаёт то же состояние, что и веб: четыре шага, скрытие и производное completed', async () => {
        const body = await (await onboarding.GET(request())).json();

        expect(Object.keys(body).sort()).toEqual(['completed', 'dismissed', 'empty', 'steps']);
        expect(Object.keys(body.steps).sort()).toEqual(['client', 'schedule', 'session', 'share']);
    });

    it('шаги отражают настоящие данные практики', async () => {
        world.clients = 1;
        world.slots = 1;

        const body = await (await onboarding.GET(request())).json();

        expect(body.steps.client).toBe(true);
        expect(body.steps.schedule).toBe(true);
        expect(body.steps.session).toBe(false);
        expect(body.empty).toBe(false);
    });
});

describe('POST /api/mobile/onboarding', () => {
    it('без авторизации ничего не пишет', async () => {
        world.authUserId = null;

        expect((await onboarding.POST(request({ action: 'dismiss' }))).status).toBe(401);
        expect(world.upserts).toEqual([]);
    });

    it('состоявшееся «поделиться» закрывает шаг', async () => {
        const body = await (await onboarding.POST(request({ action: 'shared' }))).json();

        expect(body.steps.share).toBe(true);
        expect(world.settings!.bookingLinkSharedAt).not.toBeNull();
    });

    it('«скрыть» сохраняется на сервере — значит и в вебе тоже', async () => {
        const body = await (await onboarding.POST(request({ action: 'dismiss' }))).json();

        expect(body.dismissed).toBe(true);
        expect(world.settings!.onboardingDismissedAt).not.toBeNull();
    });

    it('шаги нельзя отметить снаружи: ресурс принимает только два действия', async () => {
        for (const action of ['client', 'schedule', 'session', 'complete', { steps: { client: true } }]) {
            const res = await onboarding.POST(request({ action }));
            expect(res.status).toBe(400);
        }

        expect(world.upserts).toEqual([]);
    });

    it('пустое тело отклоняется', async () => {
        expect((await onboarding.POST(request(null))).status).toBe(400);
        expect((await onboarding.POST(request({}))).status).toBe(400);
        expect(world.upserts).toEqual([]);
    });
});
