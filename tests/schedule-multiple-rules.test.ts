// Задача 18 §1/§2 на стороне данных: несколько независимых окон одного дня.
//
// Движок доступности (Задача 6) здесь не трогается — проверяется только то,
// что действия расписания создают, правят и удаляют ОТДЕЛЬНЫЕ окна, сохраняя
// у каждого его собственные день, время, формат, кабинет и длительность.

import { describe, it, expect, vi, beforeEach } from 'vitest';

type SlotRow = {
    id: string;
    psychologistId: string;
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    duration: number | null;
    format: string | null;
    addressId: string | null;
    isActive: boolean;
    startDate: Date | null;
    endDate: Date | null;
    scheduleRuleId: string | null;
};

const world = vi.hoisted(() => ({
    slots: [] as SlotRow[],
    nextId: 1,
    // Задача 18 P0-2: кабинет окна проверяется на сервере, поэтому у
    // поддельной базы должны быть настоящие действующие кабинеты.
    addresses: [
        { id: 'a-yauzskaya', psychologistId: 'psy-1', isActive: true },
        { id: 'a-kurkino', psychologistId: 'psy-1', isActive: true },
    ],
}));

vi.mock('@/auth', () => ({ auth: vi.fn(async () => ({ user: { id: 'psy-1' } })) }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

vi.mock('@/lib/db', () => ({
    db: {
        psychologistAddress: {
            findFirst: vi.fn(async ({ where }: { where: { id: string; psychologistId: string } }) =>
                world.addresses.find(a => a.id === where.id && a.psychologistId === where.psychologistId) ?? null),
        },
        availabilitySlot: {
            findMany: vi.fn(async ({ where }: { where: { psychologistId: string; isActive?: boolean } }) =>
                world.slots.filter(s => s.psychologistId === where.psychologistId
                    && (where.isActive === undefined || s.isActive === where.isActive))),
            findUnique: vi.fn(async ({ where }: { where: { id: string } }) =>
                world.slots.find(s => s.id === where.id) ?? null),
            create: vi.fn(async ({ data }: { data: Omit<SlotRow, 'id'> }) => {
                const row = { id: `slot-${world.nextId++}`, ...data } as SlotRow;
                world.slots.push(row);
                return row;
            }),
            update: vi.fn(async ({ where, data }: { where: { id: string }; data: Partial<SlotRow> }) => {
                const row = world.slots.find(s => s.id === where.id)!;
                Object.assign(row, data);
                return row;
            }),
            deleteMany: vi.fn(async ({ where }: { where: { id: string; psychologistId: string } }) => {
                const before = world.slots.length;
                world.slots = world.slots.filter(s => !(s.id === where.id && s.psychologistId === where.psychologistId));
                return { count: before - world.slots.length };
            }),
            updateMany: vi.fn(async () => ({ count: 0 })),
        },
    },
}));

const { createAvailabilitySlot, updateAvailabilitySlot, deleteAvailabilitySlot } =
    await import('@/app/diary/actions/availability');

const MONDAY = 0;
const RANGE = { startDate: '2026-09-01', endDate: '2026-12-31' };

beforeEach(() => {
    world.slots = [];
    world.nextId = 1;
});

/** Понедельник 09:00–13:00 онлайн — первое окно дня. */
async function createMondayMorning() {
    return createAvailabilitySlot({
        ...RANGE, daysOfWeek: [MONDAY], startTime: '09:00', endTime: '13:00',
        duration: 50, format: 'online', addressId: null, scheduleRuleId: 'rule-1',
    });
}

describe('§1 второе окно того же дня', () => {
    it('создаётся рядом с первым, а не вместо него', async () => {
        await createMondayMorning();

        const second = await createAvailabilitySlot({
            ...RANGE, daysOfWeek: [MONDAY], startTime: '15:00', endTime: '21:00',
            duration: 60, format: 'offline', addressId: 'a-yauzskaya', scheduleRuleId: 'rule-1',
        });

        expect(second.success).toBe(true);
        expect(world.slots).toHaveLength(2);
        expect(world.slots.map(s => `${s.startTime}–${s.endTime}`)).toEqual(['09:00–13:00', '15:00–21:00']);
    });

    it('каждое окно понедельника хранит СВОИ формат, кабинет и длительность', async () => {
        await createMondayMorning();
        await createAvailabilitySlot({
            ...RANGE, daysOfWeek: [MONDAY], startTime: '15:00', endTime: '21:00',
            duration: 60, format: 'offline', addressId: 'a-yauzskaya', scheduleRuleId: 'rule-1',
        });

        const [morning, evening] = world.slots;
        expect(morning).toMatchObject({ dayOfWeek: MONDAY, format: 'online', addressId: null, duration: 50 });
        expect(evening).toMatchObject({ dayOfWeek: MONDAY, format: 'offline', addressId: 'a-yauzskaya', duration: 60 });
    });

    it('день недели другого окна не пересчитывается из соседнего', async () => {
        await createMondayMorning();
        await createAvailabilitySlot({
            ...RANGE, daysOfWeek: [1], startTime: '10:00', endTime: '18:00',
            duration: 50, format: 'offline', addressId: 'a-kurkino', scheduleRuleId: 'rule-1',
        });

        expect(world.slots.map(s => s.dayOfWeek)).toEqual([MONDAY, 1]);
        expect(world.slots[1]).toMatchObject({ format: 'offline', addressId: 'a-kurkino' });
    });

    it('по-настоящему пересекающееся окно по-прежнему отклоняется', async () => {
        await createMondayMorning();

        const overlapping = await createAvailabilitySlot({
            ...RANGE, daysOfWeek: [MONDAY], startTime: '12:00', endTime: '16:00',
            duration: 50, format: 'offline', addressId: 'a-yauzskaya', scheduleRuleId: 'rule-1',
        });

        expect(overlapping.success).toBe(false);
        expect(overlapping.error).toContain('пересекается');
        expect(world.slots).toHaveLength(1);
    });

    it('окно вплотную к соседнему (13:00 сразу после 09:00–13:00) пересечением не считается', async () => {
        await createMondayMorning();

        const adjacent = await createAvailabilitySlot({
            ...RANGE, daysOfWeek: [MONDAY], startTime: '13:00', endTime: '17:00',
            duration: 50, format: 'online', addressId: null, scheduleRuleId: 'rule-1',
        });

        expect(adjacent.success).toBe(true);
        expect(world.slots).toHaveLength(2);
    });
});

describe('§1 правка и удаление одного окна не задевают соседнее', () => {
    beforeEach(async () => {
        await createMondayMorning();
        await createAvailabilitySlot({
            ...RANGE, daysOfWeek: [MONDAY], startTime: '15:00', endTime: '21:00',
            duration: 60, format: 'offline', addressId: 'a-yauzskaya', scheduleRuleId: 'rule-1',
        });
    });

    it('правка вечернего окна оставляет утреннее нетронутым', async () => {
        const [morningBefore, evening] = world.slots;
        const morningSnapshot = { ...morningBefore };

        await updateAvailabilitySlot(evening.id, {
            startTime: '16:00', endTime: '20:00', duration: 60, format: 'offline', addressId: 'a-kurkino',
        });

        expect(world.slots.find(s => s.id === evening.id)).toMatchObject({
            startTime: '16:00', endTime: '20:00', addressId: 'a-kurkino',
        });
        expect(world.slots.find(s => s.id === morningSnapshot.id)).toMatchObject({
            startTime: '09:00', endTime: '13:00', format: 'online', addressId: null, duration: 50,
        });
    });

    it('перевод утреннего окна в онлайн не забирает кабинет у вечернего', async () => {
        const [morning, evening] = world.slots;

        await updateAvailabilitySlot(morning.id, {
            startTime: '09:00', endTime: '13:00', duration: 50, format: 'online', addressId: null,
        });

        expect(world.slots.find(s => s.id === evening.id)!.addressId).toBe('a-yauzskaya');
    });

    it('удаление одного окна оставляет второе окно дня', async () => {
        const [morning, evening] = world.slots;

        await deleteAvailabilitySlot(morning.id);

        expect(world.slots.map(s => s.id)).toEqual([evening.id]);
        expect(world.slots[0]).toMatchObject({ startTime: '15:00', format: 'offline', addressId: 'a-yauzskaya' });
    });

    it('чужое окно править нельзя', async () => {
        world.slots.push({
            id: 'alien', psychologistId: 'psy-2', dayOfWeek: MONDAY, startTime: '09:00', endTime: '10:00',
            duration: 50, format: 'online', addressId: null, isActive: true, startDate: null, endDate: null, scheduleRuleId: null,
        });

        const res = await updateAvailabilitySlot('alien', {
            startTime: '11:00', endTime: '12:00', duration: 50, format: 'online', addressId: null,
        });

        expect(res.success).toBe(false);
        expect(world.slots.find(s => s.id === 'alien')).toMatchObject({ startTime: '09:00', endTime: '10:00' });
    });
});
