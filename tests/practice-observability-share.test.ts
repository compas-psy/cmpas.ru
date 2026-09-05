// Задача 25 §7, §9: «поделился» и «настроил» — разные вещи, и считаются они
// по разным правилам.
//
// Отметка в продукте одна на всю жизнь аккаунта: шаг «поделиться» нельзя
// сделать дважды. А поведение — это поведение: человек, поделившийся ссылкой
// трижды, сделал это трижды, и аналитика, знающая только про первый раз, не
// умеет ответить, пользуются ли ссылкой вообще.
//
// Завершение чек-листа отправляется только на НАСТОЯЩЕМ переходе false → true
// и только после состоявшейся мутации: ни открытие дашборда, ни чтение
// состояния, ни повторное действие уже завершённого аккаунта его не рождают.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { expectRegistryClean, eventsNamed, type CapturedEvent } from './fixtures/analytics-capture';

const world = vi.hoisted(() => ({
    captured: [] as CapturedEvent[],
    clients: 0,
    slots: 0,
    sessions: [] as Array<{ date: Date; time: string }>,
    imported: 0,
    settings: null as { bookingLinkSharedAt: Date | null; onboardingDismissedAt: Date | null; timezone: string } | null,
}));

vi.mock('@/lib/analytics/track', () => ({
    track: vi.fn(async (_db: unknown, input: CapturedEvent) => { world.captured.push(input); }),
}));

vi.mock('@/lib/mobile-auth', () => ({
    authenticateMobileRequest: vi.fn(async () => ({ userId: 'psy-1' })),
    unauthorizedResponse: () => new Response('{}', { status: 401 }),
}));

vi.mock('@/lib/db', () => ({
    db: {
        diaryClient: { count: vi.fn(async () => world.clients) },
        availabilitySlot: { count: vi.fn(async () => world.slots) },
        scheduleRule: { count: vi.fn(async () => 0) },
        diarySession: {
            findMany: vi.fn(async () => world.sessions),
            count: vi.fn(async () => world.imported),
        },
        psychologistSettings: {
            findUnique: vi.fn(async () => world.settings),
            upsert: vi.fn(async ({ update }: { update: Record<string, unknown> }) => {
                Object.assign(world.settings!, update);
                return world.settings;
            }),
        },
    },
}));

const { recordBookingLinkShared, getPracticeOnboarding } = await import('@/lib/practice/onboarding');
const onboardingApi = await import('@/app/api/mobile/onboarding/route');

/** Всё сделано, кроме «поделиться»: следующее действие закроет чек-лист. */
function oneStepLeft() {
    world.clients = 3;
    world.slots = 1;
    world.imported = 2;
}

beforeEach(() => {
    world.captured = [];
    world.clients = 0;
    world.slots = 0;
    world.sessions = [];
    world.imported = 0;
    world.settings = { bookingLinkSharedAt: null, onboardingDismissedAt: null, timezone: 'Europe/Moscow' };
});

describe('поделились постоянной ссылкой', () => {
    it('состоявшееся действие в вебе — одно событие с одной поверхностью', async () => {
        await recordBookingLinkShared('psy-1', 'web');

        const shared = eventsNamed(world.captured, 'practice_booking_link_shared');
        expect(shared).toHaveLength(1);
        expect(shared[0].props).toEqual({ source: 'web' });
        expectRegistryClean(world.captured);
    });

    it('с телефона — та же запись, другая поверхность', async () => {
        await onboardingApi.POST({ json: async () => ({ action: 'shared' }) } as never);

        const [shared] = eventsNamed(world.captured, 'practice_booking_link_shared');
        expect(shared.props).toEqual({ source: 'android' });
        expectRegistryClean(world.captured);
    });

    it('поделились второй раз — второе событие, хотя шаг давно закрыт', async () => {
        await recordBookingLinkShared('psy-1', 'web');
        await recordBookingLinkShared('psy-1', 'android');

        expect(eventsNamed(world.captured, 'practice_booking_link_shared').map((e) => e.props.source))
            .toEqual(['web', 'android']);
    });

    it('а вот отметка в продукте ставится один раз: шаг нельзя сделать дважды', async () => {
        await recordBookingLinkShared('psy-1', 'web', new Date('2026-09-01T10:00:00.000Z'));
        const first = world.settings!.bookingLinkSharedAt;
        await recordBookingLinkShared('psy-1', 'web', new Date('2026-09-05T10:00:00.000Z'));

        expect(world.settings!.bookingLinkSharedAt).toEqual(first);
    });

    it('в событии нет ни ссылки, ни токена, ни кто именно поделился', async () => {
        await recordBookingLinkShared('psy-1', 'web');

        const [shared] = eventsNamed(world.captured, 'practice_booking_link_shared');
        expect(Object.keys(shared.props)).toEqual(['source']);
    });

    it('«скрыть» — не «поделиться»: ни одного события', async () => {
        await onboardingApi.POST({ json: async () => ({ action: 'dismiss' }) } as never);

        expect(world.captured).toEqual([]);
    });
});

describe('чек-лист настройки завершён', () => {
    it('последний шаг закрывает чек-лист — ровно одно событие', async () => {
        oneStepLeft();

        await recordBookingLinkShared('psy-1', 'web');

        const completed = eventsNamed(world.captured, 'practice_onboarding_completed');
        expect(completed).toHaveLength(1);
        expect(completed[0].props).toEqual({});
        expectRegistryClean(world.captured);
    });

    it('повторное действие уже настроенного аккаунта чек-лист не «завершает» снова', async () => {
        oneStepLeft();
        await recordBookingLinkShared('psy-1', 'web');
        world.captured = [];

        await recordBookingLinkShared('psy-1', 'android');

        expect(eventsNamed(world.captured, 'practice_onboarding_completed')).toHaveLength(0);
        expect(eventsNamed(world.captured, 'practice_booking_link_shared')).toHaveLength(1);
    });

    it('незакрытые шаги — значит не завершено, сколько ни делись ссылкой', async () => {
        world.clients = 0;

        await recordBookingLinkShared('psy-1', 'web');

        expect(eventsNamed(world.captured, 'practice_onboarding_completed')).toHaveLength(0);
    });

    it('чтение состояния не завершает ничего — даже у настроенного аккаунта', async () => {
        oneStepLeft();
        world.settings!.bookingLinkSharedAt = new Date('2026-09-01T10:00:00.000Z');

        const state = await getPracticeOnboarding('psy-1');
        await onboardingApi.GET({} as never);

        expect(state.completed).toBe(true);
        expect(world.captured).toEqual([]);
    });
});
