// Задача 21: кабинеты практики в приложении.
//
// Правила у кабинетов те же, что уже сделаны для веба в Задаче 18, и живут
// они в одном ядре (src/lib/practice/addresses.ts). Здесь проверяется, что
// мобильные ресурсы это ядро действительно используют, а не заводят вторую
// трактовку тех же правил.
//
// Главные из них:
//   • чужого кабинета нет — ни прочитать, ни переименовать, ни сделать
//     основным, ни вывести из работы;
//   • DELETE — это вывод из работы, а не удаление строки: у прошедших сессий
//     место встречи остаётся;
//   • пока кабинет держат будущие записи или действующее расписание, вывод
//     не проходит — 409 ADDRESS_IN_USE и ни одного молчаливого переноса.

import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest';

type AddressRow = {
    id: string;
    psychologistId: string;
    name: string;
    address: string;
    isActive: boolean;
    createdAt: Date;
};

const world = vi.hoisted(() => ({
    addresses: [] as AddressRow[],
    // date — календарный день, привязанный к полуночи UTC; время встречи
    // лежит отдельно в time. Ровно как в схеме.
    sessions: [] as Array<{ id: string; psychologistId: string; addressId: string | null; date: Date; time: string; status: string }>,
    slots: [] as Array<{ psychologistId: string; addressId: string | null; isActive: boolean }>,
    rules: [] as Array<{ psychologistId: string; addressId: string | null; isActive: boolean }>,
    officeAddress: null as string | null,
    timezone: 'Europe/Moscow',
    settingsExists: true,
    deletedAddressIds: [] as string[],
    authUserId: 'psy-1' as string | null,
    nextId: 1,
}));

vi.mock('@/lib/mobile-auth', () => ({
    authenticateMobileRequest: vi.fn(async () => (world.authUserId ? { userId: world.authUserId } : null)),
    unauthorizedResponse: () => new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
}));

vi.mock('@/lib/db', () => ({
    db: {
        psychologistAddress: {
            findFirst: vi.fn(async ({ where }: { where: { id: string; psychologistId: string } }) =>
                world.addresses.find((a) => a.id === where.id && a.psychologistId === where.psychologistId) ?? null),
            findMany: vi.fn(async ({ where }: { where: { psychologistId: string; isActive?: boolean } }) =>
                world.addresses
                    .filter((a) => a.psychologistId === where.psychologistId
                        && (where.isActive === undefined || a.isActive === where.isActive))
                    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())),
            create: vi.fn(async ({ data }: { data: { psychologistId: string; name: string; address: string } }) => {
                const row: AddressRow = {
                    id: `a-${world.nextId++}`,
                    psychologistId: data.psychologistId,
                    name: data.name,
                    address: data.address,
                    isActive: true,
                    createdAt: new Date(2026, 0, world.nextId),
                };
                world.addresses.push(row);
                return row;
            }),
            update: vi.fn(async ({ where, data }: { where: { id: string }; data: Partial<AddressRow> }) => {
                const row = world.addresses.find((a) => a.id === where.id)!;
                Object.assign(row, data);
                return row;
            }),
            // Настоящее удаление обнулило бы адрес у прошедших сессий — его
            // быть не должно; фиксируем каждый вызов.
            delete: vi.fn(async ({ where }: { where: { id: string } }) => {
                world.deletedAddressIds.push(where.id);
                world.addresses = world.addresses.filter((a) => a.id !== where.id);
                for (const session of world.sessions) {
                    if (session.addressId === where.id) session.addressId = null;
                }
                return { id: where.id };
            }),
            count: vi.fn(async ({ where }: { where: { psychologistId: string } }) =>
                world.addresses.filter((a) => a.psychologistId === where.psychologistId).length),
        },
        diarySession: {
            findMany: vi.fn(async ({ where }: {
                where: { psychologistId: string; addressId: string; date: { gte: Date }; status: { in: string[] } };
            }) => world.sessions.filter((s) => s.psychologistId === where.psychologistId
                && s.addressId === where.addressId
                && s.date >= where.date.gte
                && where.status.in.includes(s.status))),
        },
        availabilitySlot: {
            count: vi.fn(async ({ where }: { where: { psychologistId: string; addressId: string; isActive: boolean } }) =>
                world.slots.filter((s) => s.psychologistId === where.psychologistId
                    && s.addressId === where.addressId && s.isActive === where.isActive).length),
        },
        scheduleRule: {
            count: vi.fn(async ({ where }: { where: { psychologistId: string; addressId: string; isActive: boolean } }) =>
                world.rules.filter((r) => r.psychologistId === where.psychologistId
                    && r.addressId === where.addressId && r.isActive === where.isActive).length),
        },
        psychologistSettings: {
            findUnique: vi.fn(async () => (world.settingsExists
                ? { officeAddress: world.officeAddress, timezone: world.timezone }
                : null)),
            update: vi.fn(async ({ data }: { data: { officeAddress: string | null } }) => {
                world.officeAddress = data.officeAddress;
                return { officeAddress: world.officeAddress };
            }),
            upsert: vi.fn(async ({ create, update }: {
                create: { officeAddress: string }; update: { officeAddress: string };
            }) => {
                world.officeAddress = world.settingsExists ? update.officeAddress : create.officeAddress;
                world.settingsExists = true;
                return { officeAddress: world.officeAddress };
            }),
        },
    },
}));

const list = await import('@/app/api/mobile/addresses/route');
const one = await import('@/app/api/mobile/addresses/[id]/route');

function request(body?: unknown) {
    return { json: async () => body } as never;
}

function params(id: string) {
    return { params: Promise.resolve({ id }) };
}

/** Календарный день, привязанный к полуночи UTC, — как в DiarySession.date. */
function day(iso: string): Date {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d));
}

/**
 * Сегодня по часам практики — 5 сентября 2026, 14:00 в Москве.
 * В UTC это 11:00, и именно на этом расхождении ловится сравнение по
 * серверным часам вместо часов практики.
 */
const NOW = new Date('2026-09-05T11:00:00.000Z');
const TODAY = '2026-09-05';
const TOMORROW = '2026-09-06';
const YESTERDAY = '2026-09-04';

/** Назначенная запись в этом кабинете. */
function sessionAt(date: string, time: string, status = 'confirmed') {
    return { id: 's-planned', psychologistId: 'psy-1', addressId: 'a-yauzskaya', date: day(date), time, status };
}

// Подменяется только Date: таймеры настоящие, чтобы промисы вели себя как в
// обычном прогоне.
beforeAll(() => vi.useFakeTimers({ toFake: ['Date'] }));
afterAll(() => vi.useRealTimers());

beforeEach(() => {
    vi.setSystemTime(NOW);
    world.addresses = [
        { id: 'a-yauzskaya', psychologistId: 'psy-1', name: 'Яузская', address: 'Москва, Яузская ул., 8с2', isActive: true, createdAt: new Date(2026, 0, 1) },
        { id: 'a-kurkino', psychologistId: 'psy-1', name: 'Куркино', address: 'Москва, Соловьиная роща, 1', isActive: true, createdAt: new Date(2026, 0, 2) },
        { id: 'a-alien', psychologistId: 'psy-2', name: 'Чужой', address: 'Не ваш адрес', isActive: true, createdAt: new Date(2026, 0, 3) },
    ];
    world.sessions = [{
        id: 's-past', psychologistId: 'psy-1', addressId: 'a-yauzskaya',
        date: day('2025-09-05'), time: '10:00', status: 'completed',
    }];
    world.timezone = 'Europe/Moscow';
    world.slots = [];
    world.rules = [];
    world.officeAddress = 'a-yauzskaya';
    world.settingsExists = true;
    world.deletedAddressIds = [];
    world.authUserId = 'psy-1';
    world.nextId = 1;
});

describe('GET /api/mobile/addresses', () => {
    it('без авторизации не отвечает', async () => {
        world.authUserId = null;

        expect((await list.GET(request())).status).toBe(401);
    });

    it('отдаёт только свои действующие кабинеты и отмечает основной', async () => {
        world.addresses.find((a) => a.id === 'a-kurkino')!.isActive = false;

        const body = await (await list.GET(request())).json();

        expect(body.addresses.map((a: { id: string }) => a.id)).toEqual(['a-yauzskaya']);
        expect(body.addresses[0]).toMatchObject({
            id: 'a-yauzskaya',
            name: 'Яузская',
            address: 'Москва, Яузская ул., 8с2',
            isPrimary: true,
        });
    });

    it('чужой кабинет в список не попадает', async () => {
        const body = await (await list.GET(request())).json();

        expect(body.addresses.map((a: { id: string }) => a.id)).not.toContain('a-alien');
    });
});

describe('POST /api/mobile/addresses', () => {
    it('создаёт кабинет своему специалисту', async () => {
        const res = await list.POST(request({ name: 'Покровка', address: 'Москва, Покровка, 3' }));
        const created = await res.json();

        expect(res.status).toBe(201);
        expect(created).toMatchObject({ name: 'Покровка', address: 'Москва, Покровка, 3' });
        const row = world.addresses.find((a) => a.id === created.id)!;
        expect(row.psychologistId).toBe('psy-1');
    });

    it('первый кабинет практики сам становится основным', async () => {
        world.addresses = [];
        world.officeAddress = null;

        const created = await (await list.POST(request({ name: 'Яузская', address: 'Москва, Яузская ул., 8с2' }))).json();

        expect(created.isPrimary).toBe(true);
        expect(world.officeAddress).toBe(created.id);
    });

    it('второй кабинет основным сам не становится', async () => {
        world.addresses = [];
        world.officeAddress = null;

        const first = await (await list.POST(request({ name: 'Яузская', address: 'Яузская, 8' }))).json();
        const second = await (await list.POST(request({ name: 'Куркино', address: 'Соловьиная роща, 1' }))).json();

        expect(second.isPrimary).toBe(false);
        expect(world.officeAddress).toBe(first.id);
    });

    it('адрес вводится вручную: подсказки не условие сохранения', async () => {
        // Ни справочника, ни кода города, ни нормализованной строки — просто
        // то, что человек напечатал.
        const res = await list.POST(request({ name: 'Дом', address: 'деревня Клюквино, у почты' }));

        expect(res.status).toBe(201);
        expect((await res.json()).address).toBe('деревня Клюквино, у почты');
    });

    it('пустое название или адрес не сохраняются', async () => {
        const before = world.addresses.length;

        expect((await list.POST(request({ name: '  ', address: 'Москва' }))).status).toBe(400);
        expect((await list.POST(request({ name: 'Кабинет', address: '' }))).status).toBe(400);
        expect(world.addresses).toHaveLength(before);
    });
});

describe('PATCH /api/mobile/addresses/:id', () => {
    it('меняет название и адрес', async () => {
        const res = await one.PATCH(
            request({ name: 'Яузская, 2 этаж', address: 'Москва, Яузская ул., 8с2, каб. 12' }),
            params('a-yauzskaya'),
        );

        expect(res.status).toBe(200);
        const row = world.addresses.find((a) => a.id === 'a-yauzskaya')!;
        expect(row.name).toBe('Яузская, 2 этаж');
        expect(row.address).toBe('Москва, Яузская ул., 8с2, каб. 12');
    });

    it('делает кабинет основным и снимает метку с прежнего', async () => {
        const body = await (await one.PATCH(request({ isPrimary: true }), params('a-kurkino'))).json();

        expect(world.officeAddress).toBe('a-kurkino');
        const marked = body.addresses.filter((a: { isPrimary: boolean }) => a.isPrimary);
        expect(marked).toHaveLength(1);
        expect(marked[0].id).toBe('a-kurkino');
    });

    it('чужой кабинет не переименовать и не сделать основным', async () => {
        expect((await one.PATCH(request({ name: 'Взлом' }), params('a-alien'))).status).toBe(404);
        expect((await one.PATCH(request({ isPrimary: true }), params('a-alien'))).status).toBe(404);

        expect(world.addresses.find((a) => a.id === 'a-alien')!.name).toBe('Чужой');
        expect(world.officeAddress).toBe('a-yauzskaya');
    });

    it('произвольные поля через эту дверь не проходят', async () => {
        const res = await one.PATCH(request({ isActive: false, psychologistId: 'psy-2' }), params('a-yauzskaya'));

        expect(res.status).toBe(400);
        expect(await res.json()).toEqual({ error: 'NOTHING_TO_UPDATE' });
        const row = world.addresses.find((a) => a.id === 'a-yauzskaya')!;
        expect(row.isActive).toBe(true);
        expect(row.psychologistId).toBe('psy-1');
    });
});

describe('DELETE /api/mobile/addresses/:id — вывод из работы', () => {
    it('без зависимостей кабинет уходит из активного списка', async () => {
        const body = await (await one.DELETE(request(), params('a-kurkino'))).json();

        expect(body.addresses.map((a: { id: string }) => a.id)).toEqual(['a-yauzskaya']);
        expect(world.addresses.find((a) => a.id === 'a-kurkino')!.isActive).toBe(false);
    });

    it('строка кабинета остаётся в базе, прошедшая сессия сохраняет адрес', async () => {
        await one.DELETE(request(), params('a-yauzskaya'));

        expect(world.deletedAddressIds).toEqual([]);
        expect(world.addresses.map((a) => a.id)).toContain('a-yauzskaya');
        expect(world.sessions[0].addressId).toBe('a-yauzskaya');
    });

    it('выведенный кабинет перестаёт быть основным', async () => {
        await one.DELETE(request(), params('a-yauzskaya'));

        expect(world.officeAddress).toBeNull();
    });

    it('будущая запись держит кабинет — 409 ADDRESS_IN_USE', async () => {
        vi.setSystemTime(NOW);
        world.sessions.push(sessionAt(TOMORROW, '10:00'));

        const res = await one.DELETE(request(), params('a-yauzskaya'));
        const body = await res.json();

        expect(res.status).toBe(409);
        expect(body.error).toBe('ADDRESS_IN_USE');
        expect(body.futureSessions).toBe(1);
        // Ничего не изменилось и ничего не переназначилось молча.
        expect(world.addresses.find((a) => a.id === 'a-yauzskaya')!.isActive).toBe(true);
        expect(world.sessions.find((s) => s.id === 's-planned')!.addressId).toBe('a-yauzskaya');
    });

    it('действующее правило расписания держит кабинет — 409 ADDRESS_IN_USE', async () => {
        world.rules.push({ psychologistId: 'psy-1', addressId: 'a-yauzskaya', isActive: true });

        const res = await one.DELETE(request(), params('a-yauzskaya'));
        const body = await res.json();

        expect(res.status).toBe(409);
        expect(body.error).toBe('ADDRESS_IN_USE');
        expect(body.activeSchedule).toBe(1);
        expect(world.addresses.find((a) => a.id === 'a-yauzskaya')!.isActive).toBe(true);
        expect(world.rules[0].addressId).toBe('a-yauzskaya');
    });

    it('окно расписания держит кабинет так же, как правило', async () => {
        world.slots.push({ psychologistId: 'psy-1', addressId: 'a-yauzskaya', isActive: true });

        expect((await one.DELETE(request(), params('a-yauzskaya'))).status).toBe(409);
    });

    it('прошедшая сессия и выключенное правило кабинет не держат', async () => {
        world.rules.push({ psychologistId: 'psy-1', addressId: 'a-yauzskaya', isActive: false });

        expect((await one.DELETE(request(), params('a-yauzskaya'))).status).toBe(200);
        expect(world.addresses.find((a) => a.id === 'a-yauzskaya')!.isActive).toBe(false);
    });

    // ── День + время, а не только день ──
    //
    // DiarySession.date хранит календарный день в 00:00, время встречи лежит
    // отдельно в time. Проверка «date >= now» отбрасывала весь сегодняшний
    // день: в два часа дня встреча на восемь вечера считалась прошедшей, и
    // кабинет выводился из работы прямо из-под назначенной записи.

    it('сегодня 14:00, встреча сегодня в 20:00 — держит кабинет, DELETE даёт 409', async () => {
        world.sessions.push(sessionAt(TODAY, '20:00'));

        const res = await one.DELETE(request(), params('a-yauzskaya'));

        expect(res.status).toBe(409);
        expect((await res.json()).futureSessions).toBe(1);
        expect(world.addresses.find((a) => a.id === 'a-yauzskaya')!.isActive).toBe(true);
    });

    it('сегодня 14:00, встреча сегодня в 10:00 — уже прошла, кабинет не держит', async () => {
        world.sessions.push(sessionAt(TODAY, '10:00'));

        expect((await one.DELETE(request(), params('a-yauzskaya'))).status).toBe(200);
        expect(world.addresses.find((a) => a.id === 'a-yauzskaya')!.isActive).toBe(false);
    });

    it('встреча завтра утром держит кабинет', async () => {
        world.sessions.push(sessionAt(TOMORROW, '10:00'));

        expect((await one.DELETE(request(), params('a-yauzskaya'))).status).toBe(409);
    });

    it('вчерашняя встреча кабинет не держит', async () => {
        world.sessions.push(sessionAt(YESTERDAY, '20:00'));

        expect((await one.DELETE(request(), params('a-yauzskaya'))).status).toBe(200);
    });

    it('отменённая сегодняшняя встреча на 20:00 кабинет не держит', async () => {
        world.sessions.push(sessionAt(TODAY, '20:00', 'cancelled'));

        expect((await one.DELETE(request(), params('a-yauzskaya'))).status).toBe(200);
    });

    it('«сейчас» берётся по часам практики, а не по UTC сервера', async () => {
        // Тот же момент времени: 11:00 UTC — это 14:00 в Москве и 21:00 во
        // Владивостоке. Встреча на 20:00 в московской практике ещё впереди,
        // во владивостокской — уже позади.
        world.sessions.push(sessionAt(TODAY, '20:00'));

        world.timezone = 'Asia/Vladivostok';
        expect((await one.DELETE(request(), params('a-yauzskaya'))).status).toBe(200);

        world.addresses.find((a) => a.id === 'a-yauzskaya')!.isActive = true;
        world.timezone = 'Europe/Moscow';
        expect((await one.DELETE(request(), params('a-yauzskaya'))).status).toBe(409);
    });

    it('чужой кабинет вывести из работы нельзя', async () => {
        const res = await one.DELETE(request(), params('a-alien'));

        expect(res.status).toBe(404);
        expect(world.addresses.find((a) => a.id === 'a-alien')!.isActive).toBe(true);
    });

    it('без авторизации не выводит', async () => {
        world.authUserId = null;

        expect((await one.DELETE(request(), params('a-yauzskaya'))).status).toBe(401);
        expect(world.addresses.find((a) => a.id === 'a-yauzskaya')!.isActive).toBe(true);
    });
});
