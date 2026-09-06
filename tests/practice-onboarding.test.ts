// Задача 24: онбординг — одно серверное состояние на веб и приложение.
//
// До этого «онбординг» был тремя разными вещами: веб считал шаги сам, прятал
// полосу через localStorage и редиректил по грубому onboardingCompleted, а
// приложение получало один булев признак. Здесь проверяется единственный
// источник — src/lib/practice/onboarding.ts — и главное правило: три шага
// ВЫЧИСЛЯЮТСЯ из настоящих данных практики, их нельзя отметить снаружи.
//
// Четвёртый, «поделиться», данными не виден: ссылка есть у всех с первого
// дня. Поэтому у него отдельная отметка, и ставит её только состоявшееся
// действие человека — не открытие шторки и не аналитика.

import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest';

type SessionRow = { date: Date; time: string; status: string; origin: string };

const world = vi.hoisted(() => ({
    clients: [] as Array<{ status: string }>,
    slots: [] as Array<{ isActive: boolean }>,
    rules: [] as Array<{ isActive: boolean }>,
    sessions: [] as SessionRow[],
    settings: null as { bookingLinkSharedAt: Date | null; onboardingDismissedAt: Date | null; timezone: string } | null,
    upserts: [] as Array<Record<string, unknown>>,
}));

function matchesDate(row: SessionRow, where: { date?: { gte: Date }; status?: { notIn?: string[]; not?: string }; origin?: { in: string[] } }) {
    if (where.date && row.date < where.date.gte) return false;
    if (where.status?.notIn && where.status.notIn.includes(row.status)) return false;
    if (where.status?.not && row.status === where.status.not) return false;
    if (where.origin && !where.origin.in.includes(row.origin)) return false;
    return true;
}

vi.mock('@/lib/db', () => ({
    db: {
        diaryClient: {
            count: vi.fn(async ({ where }: { where: { status: { not: string } } }) =>
                world.clients.filter((c) => c.status !== where.status.not).length),
        },
        availabilitySlot: {
            count: vi.fn(async ({ where }: { where: { isActive: boolean } }) =>
                world.slots.filter((s) => s.isActive === where.isActive).length),
        },
        scheduleRule: {
            count: vi.fn(async ({ where }: { where: { isActive: boolean } }) =>
                world.rules.filter((r) => r.isActive === where.isActive).length),
        },
        diarySession: {
            count: vi.fn(async ({ where }: { where: Parameters<typeof matchesDate>[1] }) =>
                world.sessions.filter((s) => matchesDate(s, where)).length),
            findMany: vi.fn(async ({ where }: { where: Parameters<typeof matchesDate>[1] }) =>
                world.sessions.filter((s) => matchesDate(s, where))),
        },
        psychologistSettings: {
            findUnique: vi.fn(async () => world.settings),
            upsert: vi.fn(async ({ create, update }: { create: Record<string, unknown>; update: Record<string, unknown> }) => {
                world.upserts.push(update);
                if (!world.settings) {
                    world.settings = {
                        bookingLinkSharedAt: null,
                        onboardingDismissedAt: null,
                        timezone: 'Europe/Moscow',
                        ...(create as Record<string, never>),
                    };
                } else {
                    Object.assign(world.settings, update);
                }
                return world.settings;
            }),
        },
    },
}));

const {
    getPracticeOnboarding,
    markBookingLinkShared,
    dismissPracticeOnboarding,
} = await import('@/lib/practice/onboarding');

/** Календарный день, привязанный к полуночи UTC, — как в DiarySession.date. */
function day(iso: string): Date {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d));
}

/**
 * Сегодня по часам практики — 5 сентября 2026, 18:00 в Москве.
 * В UTC это 15:00, и именно на этом расхождении ловится сравнение по
 * серверным часам вместо часов практики.
 */
const NOW = new Date('2026-09-05T15:00:00.000Z');
const TODAY = '2026-09-05';
const TOMORROW = '2026-09-06';
const LAST_MONTH = '2026-08-05';

function session(date: string, time = '10:00', status = 'confirmed', origin = 'manual'): SessionRow {
    return { date: day(date), time, status, origin };
}

beforeAll(() => vi.useFakeTimers({ toFake: ['Date'] }));
afterAll(() => vi.useRealTimers());

beforeEach(() => {
    vi.setSystemTime(NOW);
    world.clients = [];
    world.slots = [];
    world.rules = [];
    world.sessions = [];
    world.settings = { bookingLinkSharedAt: null, onboardingDismissedAt: null, timezone: 'Europe/Moscow' };
    world.upserts = [];
});

const state = () => getPracticeOnboarding('psy-1');

describe('шаг «Клиенты»', () => {
    it('без клиентов не выполнен', async () => {
        expect((await state()).steps.client).toBe(false);
    });

    it('действующий клиент закрывает шаг', async () => {
        world.clients = [{ status: 'active' }];

        expect((await state()).steps.client).toBe(true);
    });

    it('перенесённый импортом клиент ничем не отличается от заведённого руками', async () => {
        // У DiaryClient нет признака «импортирован»: импорт создаёт обычные
        // карточки. Именно поэтому мигрировавший специалист не должен
        // заводить «первого клиента» заново.
        world.clients = [{ status: 'active' }, { status: 'paused' }];

        expect((await state()).steps.client).toBe(true);
    });

    it('практика, где всех архивировали, не считается настроенной', async () => {
        world.clients = [{ status: 'archived' }];

        expect((await state()).steps.client).toBe(false);
    });
});

describe('шаг «Расписание»', () => {
    it('без расписания не выполнен', async () => {
        expect((await state()).steps.schedule).toBe(false);
    });

    it('действующее окно закрывает шаг', async () => {
        world.slots = [{ isActive: true }];

        expect((await state()).steps.schedule).toBe(true);
    });

    it('действующее правило закрывает шаг так же, как окно', async () => {
        world.rules = [{ isActive: true }];

        expect((await state()).steps.schedule).toBe(true);
    });

    it('только выключенные — шаг не выполнен: они никого никуда не ведут', async () => {
        world.slots = [{ isActive: false }];
        world.rules = [{ isActive: false }];

        expect((await state()).steps.schedule).toBe(false);
    });
});

describe('шаг «Запись»', () => {
    // Сравнение только по дню отбрасывало бы весь сегодняшний день целиком: в
    // шесть вечера прошедшая утренняя встреча всё ещё считалась бы будущей, и
    // шаг закрывался бы тем, что уже позади.

    it('без записей не выполнен', async () => {
        expect((await state()).steps.session).toBe(false);
    });

    it('сейчас 18:00, встреча сегодня в 20:00 — впереди, шаг закрыт', async () => {
        world.sessions = [session(TODAY, '20:00')];

        expect((await state()).steps.session).toBe(true);
    });

    it('сейчас 18:00, встреча сегодня в 10:00 — уже прошла, шаг не закрыт', async () => {
        world.sessions = [session(TODAY, '10:00')];

        expect((await state()).steps.session).toBe(false);
    });

    it('сегодняшняя встреча со статусом «состоялась» шаг не закрывает', async () => {
        world.sessions = [session(TODAY, '10:00', 'completed')];

        expect((await state()).steps.session).toBe(false);
    });

    it('встреча завтра утром закрывает шаг', async () => {
        world.sessions = [session(TOMORROW, '10:00')];

        expect((await state()).steps.session).toBe(true);
    });

    it('перенесённая импортом запись закрывает шаг, даже если она в прошлом', async () => {
        // Импорт переносит уже сложившуюся практику: требовать от такого
        // специалиста «первую запись» заново было бы издевательством.
        world.sessions = [session(LAST_MONTH, '10:00', 'completed', 'calendar_import')];

        expect((await state()).steps.session).toBe(true);
    });

    it('отменённая импортированная запись шаг не закрывает', async () => {
        world.sessions = [session(LAST_MONTH, '10:00', 'cancelled', 'spreadsheet_import')];

        expect((await state()).steps.session).toBe(false);
    });

    it('отменённая будущая запись настройку не доказывает', async () => {
        world.sessions = [session(TOMORROW, '10:00', 'cancelled')];

        expect((await state()).steps.session).toBe(false);
    });

    it('прошедшая запись, заведённая руками, шаг не закрывает', async () => {
        world.sessions = [session(LAST_MONTH, '10:00', 'completed', 'manual')];

        expect((await state()).steps.session).toBe(false);
    });

    it('«сейчас» берётся по часам практики, а не по UTC сервера', async () => {
        // Один и тот же момент: 15:00 UTC — это 18:00 в Москве и 01:00
        // следующего дня во Владивостоке. Встреча на 20:00 «сегодня» в
        // московской практике ещё впереди; во владивостокской сегодня уже
        // шестое число, и пятое — прошлое.
        world.sessions = [session(TODAY, '20:00')];

        expect((await state()).steps.session).toBe(true);

        world.settings!.timezone = 'Asia/Vladivostok';
        expect((await state()).steps.session).toBe(false);
    });
});

describe('шаг «Поделиться»', () => {
    it('ссылка существует у всех — сама по себе шаг не закрывает', async () => {
        expect((await state()).steps.share).toBe(false);
    });

    it('открытие шторки ничего не меняет: состояние трогает только действие', async () => {
        // Открытие шторки не вызывает markBookingLinkShared — значит отметки
        // на сервере не появляется и шаг остаётся невыполненным.
        expect((await state()).steps.share).toBe(false);
        expect(world.upserts).toEqual([]);
    });

    it('состоявшееся действие закрывает шаг', async () => {
        await markBookingLinkShared('psy-1');

        expect((await state()).steps.share).toBe(true);
        expect(world.settings!.bookingLinkSharedAt).toEqual(NOW);
    });

    it('отметка ставится один раз и не переписывается', async () => {
        await markBookingLinkShared('psy-1');
        const first = world.settings!.bookingLinkSharedAt;

        vi.setSystemTime(new Date('2026-09-06T11:00:00.000Z'));
        await markBookingLinkShared('psy-1');

        expect(world.settings!.bookingLinkSharedAt).toEqual(first);
        expect(world.upserts).toHaveLength(1);
    });
});

describe('«Скрыть»', () => {
    it('по умолчанию подсказка не скрыта', async () => {
        expect((await state()).dismissed).toBe(false);
    });

    it('решение сохраняется на сервере', async () => {
        await dismissPracticeOnboarding('psy-1');

        expect(world.settings!.onboardingDismissedAt).toEqual(NOW);
        expect((await state()).dismissed).toBe(true);
    });

    it('другой браузер или переустановка приложения подсказку не возвращают', async () => {
        await dismissPracticeOnboarding('psy-1');

        // Другое устройство — это просто ещё один запрос к тому же серверу;
        // никакого локального хранилища в решении не участвует.
        expect((await getPracticeOnboarding('psy-1')).dismissed).toBe(true);
    });
});

describe('общее состояние', () => {
    it('все четыре шага сделаны — completed', async () => {
        world.clients = [{ status: 'active' }];
        world.slots = [{ isActive: true }];
        world.sessions = [session(TOMORROW, '10:00')];
        await markBookingLinkShared('psy-1');

        const result = await state();
        expect(result.steps).toEqual({ client: true, schedule: true, session: true, share: true });
        expect(result.completed).toBe(true);
    });

    it('три из четырёх — ещё не completed', async () => {
        world.clients = [{ status: 'active' }];
        world.slots = [{ isActive: true }];
        world.sessions = [session(TOMORROW, '10:00')];

        expect((await state()).completed).toBe(false);
    });

    it('пустой аккаунт помечен пустым — только ему предлагают выбор входа', async () => {
        expect((await state()).empty).toBe(true);
    });

    it('заведён хоть один клиент — выбор входа уже сделан', async () => {
        world.clients = [{ status: 'active' }];

        expect((await state()).empty).toBe(false);
    });

    it('перенесённая практика приходит с закрытыми клиентами и записью, остальное — по факту', async () => {
        world.clients = [{ status: 'active' }];
        world.sessions = [session(LAST_MONTH, '10:00', 'completed', 'calendar_import')];

        const result = await state();
        expect(result.steps).toEqual({ client: true, schedule: false, session: true, share: false });
        expect(result.empty).toBe(false);
        expect(result.completed).toBe(false);
    });

    it('состояние не хранит четырёх булевых полей — только две отметки времени', async () => {
        world.clients = [{ status: 'active' }];
        await markBookingLinkShared('psy-1');
        await dismissPracticeOnboarding('psy-1');

        // В базу ушли ровно две отметки; шаги нигде не записаны.
        expect(world.upserts).toEqual([
            { bookingLinkSharedAt: NOW },
            { onboardingDismissedAt: NOW },
        ]);
    });
});
