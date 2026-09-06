// Задача 22: блокировка времени с телефона.
//
// Ресурс /api/mobile/blocks существовал и раньше — второго не заводим. Здесь
// проверяется то, на что опирается экран календаря:
//
//   • блокировка создаётся своему специалисту и только ему;
//   • чужие блокировки не видны и не удаляются;
//   • конец раньше начала сервер не принимает — валидация не только на
//     клиенте;
//   • без явной просьбы ни одна клиентская запись не отменяется: молча
//     отменить встречу человека нельзя;
//   • день сохраняется как календарная дата в полночь UTC — ровно в той
//     системе координат, в которой блокировку потом читает резолвер
//     доступности. Иначе блокировка «есть», а время клиенту всё равно
//     предлагается.

import { describe, it, expect, vi, beforeEach } from 'vitest';

type BlockRow = {
    id: string;
    psychologistId: string;
    date: Date;
    startTime: string;
    endTime: string;
    type: string;
    reason: string | null;
};

const world = vi.hoisted(() => ({
    blocks: [] as BlockRow[],
    sessions: [] as Array<{ id: string; psychologistId: string; status: string }>,
    cancelledIds: [] as string[],
    authUserId: 'psy-1' as string | null,
    nextId: 1,
}));

vi.mock('@/lib/mobile-auth', () => ({
    authenticateMobileRequest: vi.fn(async () => (world.authUserId ? { userId: world.authUserId } : null)),
    unauthorizedResponse: () => new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
}));

vi.mock('@/lib/db', () => ({
    db: {
        diaryBlock: {
            findMany: vi.fn(async ({ where }: { where: { psychologistId: string; date?: { gte: Date; lte: Date } } }) =>
                world.blocks.filter((b) => b.psychologistId === where.psychologistId
                    && (!where.date || (b.date >= where.date.gte && b.date <= where.date.lte)))),
            findFirst: vi.fn(async ({ where }: { where: { id: string; psychologistId: string } }) =>
                world.blocks.find((b) => b.id === where.id && b.psychologistId === where.psychologistId) ?? null),
            createMany: vi.fn(async ({ data }: { data: Omit<BlockRow, 'id'>[] }) => {
                for (const row of data) world.blocks.push({ id: `b-${world.nextId++}`, ...row });
                return { count: data.length };
            }),
            delete: vi.fn(async ({ where }: { where: { id: string } }) => {
                world.blocks = world.blocks.filter((b) => b.id !== where.id);
                return { id: where.id };
            }),
        },
        diarySession: {
            findMany: vi.fn(async () => world.sessions),
            updateMany: vi.fn(async ({ where }: { where: { id: { in: string[] } } }) => {
                world.cancelledIds.push(...where.id.in);
                return { count: where.id.in.length };
            }),
        },
    },
}));

const list = await import('@/app/api/mobile/blocks/route');
const one = await import('@/app/api/mobile/blocks/[id]/route');

function post(body: unknown) {
    return { json: async () => body } as never;
}

function get(query: Record<string, string> = {}) {
    const params = new URLSearchParams(query);
    return { nextUrl: { searchParams: params } } as never;
}

function params(id: string) {
    return { params: Promise.resolve({ id }) };
}

beforeEach(() => {
    world.blocks = [];
    world.sessions = [];
    world.cancelledIds = [];
    world.authUserId = 'psy-1';
    world.nextId = 1;
});

describe('POST /api/mobile/blocks', () => {
    it('без авторизации не создаёт', async () => {
        world.authUserId = null;

        expect((await list.POST(post({ date: '2026-09-10', startTime: '14:00', endTime: '17:00' }))).status).toBe(401);
        expect(world.blocks).toEqual([]);
    });

    it('создаёт блокировку своему специалисту', async () => {
        const res = await list.POST(post({
            date: '2026-09-10', startTime: '14:00', endTime: '17:00', reason: 'Врач',
        }));

        expect(res.status).toBe(201);
        expect(world.blocks).toHaveLength(1);
        expect(world.blocks[0]).toMatchObject({
            psychologistId: 'psy-1',
            startTime: '14:00',
            endTime: '17:00',
            reason: 'Врач',
        });
    });

    it('причина необязательна', async () => {
        await list.POST(post({ date: '2026-09-10', startTime: '14:00', endTime: '17:00' }));

        expect(world.blocks).toHaveLength(1);
        expect(world.blocks[0].reason).toBeNull();
    });

    it('конец раньше или равен началу не сохраняется', async () => {
        expect((await list.POST(post({ date: '2026-09-10', startTime: '17:00', endTime: '14:00' }))).status).toBe(400);
        expect((await list.POST(post({ date: '2026-09-10', startTime: '14:00', endTime: '14:00' }))).status).toBe(400);
        expect(world.blocks).toEqual([]);
    });

    it('дата обязательна', async () => {
        expect((await list.POST(post({ startTime: '14:00', endTime: '17:00' }))).status).toBe(400);
        expect(world.blocks).toEqual([]);
    });

    it('день сохраняется полночью UTC — в той же системе координат, где его читает доступность', async () => {
        await list.POST(post({ date: '2026-09-10', startTime: '14:00', endTime: '17:00' }));

        expect(world.blocks[0].date.toISOString()).toBe('2026-09-10T00:00:00.000Z');
    });

    it('без явной просьбы ни одна клиентская запись не отменяется', async () => {
        world.sessions = [{ id: 's-1', psychologistId: 'psy-1', status: 'confirmed' }];

        await list.POST(post({ date: '2026-09-10', startTime: '14:00', endTime: '17:00' }));

        expect(world.cancelledIds).toEqual([]);
    });
});

describe('GET /api/mobile/blocks', () => {
    beforeEach(() => {
        world.blocks = [
            { id: 'b-mine', psychologistId: 'psy-1', date: new Date('2026-09-10T00:00:00.000Z'), startTime: '14:00', endTime: '17:00', type: 'personal', reason: 'Врач' },
            { id: 'b-alien', psychologistId: 'psy-2', date: new Date('2026-09-10T00:00:00.000Z'), startTime: '09:00', endTime: '10:00', type: 'personal', reason: null },
        ];
    });

    it('отдаёт только свои блокировки', async () => {
        const body = await (await list.GET(get({ from: '2026-09-01', to: '2026-09-30' }))).json();

        expect(body.map((b: { id: string }) => b.id)).toEqual(['b-mine']);
    });

    it('чужие блокировки не видны и в чужой сессии', async () => {
        world.authUserId = 'psy-3';

        const body = await (await list.GET(get())).json();

        expect(body).toEqual([]);
    });
});

describe('DELETE /api/mobile/blocks/:id', () => {
    beforeEach(() => {
        world.blocks = [
            { id: 'b-mine', psychologistId: 'psy-1', date: new Date('2026-09-10T00:00:00.000Z'), startTime: '14:00', endTime: '17:00', type: 'personal', reason: null },
            { id: 'b-alien', psychologistId: 'psy-2', date: new Date('2026-09-10T00:00:00.000Z'), startTime: '09:00', endTime: '10:00', type: 'personal', reason: null },
        ];
    });

    it('свою блокировку снимает', async () => {
        expect((await one.DELETE(get(), params('b-mine'))).status).toBe(200);
        expect(world.blocks.map((b) => b.id)).toEqual(['b-alien']);
    });

    it('чужую не снимает и не признаётся, что она есть', async () => {
        const res = await one.DELETE(get(), params('b-alien'));

        expect(res.status).toBe(404);
        expect(world.blocks.map((b) => b.id).sort()).toEqual(['b-alien', 'b-mine']);
    });
});
