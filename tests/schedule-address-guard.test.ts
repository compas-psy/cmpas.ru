// Задача 18, P0-2: addressId проверяется на серверной границе.
//
// Инвариант: у любого действующего очного правила или окна кабинет
// принадлежит этому специалисту и находится в работе. Раньше addressId
// принимался как есть — чужой или уже выведенный из работы кабинет спокойно
// сохранялся, а онлайн-окно могло унести с собой подсунутый кабинет.

import { describe, it, expect, vi, beforeEach } from 'vitest';

type AddressRow = { id: string; psychologistId: string; isActive: boolean };
type SlotRow = {
    id: string; psychologistId: string; dayOfWeek: number; startTime: string; endTime: string;
    duration: number | null; format: string | null; addressId: string | null; isActive: boolean;
    startDate: Date | null; endDate: Date | null; scheduleRuleId: string | null;
};
type RuleRow = {
    id: string; psychologistId: string; name: string; color: string | null; priority: number; isActive: boolean;
    format: string; addressId: string | null; duration: number; breakDuration: number; audienceFilter: string;
    startDate: Date | null; endDate: Date | null;
};

const world = vi.hoisted(() => ({
    addresses: [] as AddressRow[],
    slots: [] as SlotRow[],
    rules: [] as RuleRow[],
    createdSlots: [] as Partial<SlotRow>[],
    nextId: 1,
}));

vi.mock('@/auth', () => ({ auth: vi.fn(async () => ({ user: { id: 'psy-1' } })) }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

vi.mock('@/lib/db', () => ({
    db: {
        psychologistAddress: {
            findFirst: vi.fn(async ({ where }: { where: { id: string; psychologistId: string } }) =>
                world.addresses.find(a => a.id === where.id && a.psychologistId === where.psychologistId) ?? null),
            findMany: vi.fn(async () => world.addresses),
        },
        availabilitySlot: {
            findMany: vi.fn(async ({ where }: { where: { psychologistId: string } }) =>
                world.slots.filter(s => s.psychologistId === where.psychologistId)),
            findUnique: vi.fn(async ({ where }: { where: { id: string } }) =>
                world.slots.find(s => s.id === where.id) ?? null),
            create: vi.fn(async ({ data }: { data: Partial<SlotRow> }) => {
                const row = { id: `slot-${world.nextId++}`, ...data } as SlotRow;
                world.slots.push(row);
                world.createdSlots.push(row);
                return row;
            }),
            update: vi.fn(async ({ where, data }: { where: { id: string }; data: Partial<SlotRow> }) => {
                const row = world.slots.find(s => s.id === where.id)!;
                Object.assign(row, data);
                return row;
            }),
            updateMany: vi.fn(async () => ({ count: 0 })),
            deleteMany: vi.fn(async () => ({ count: 0 })),
        },
        scheduleRule: {
            findMany: vi.fn(async () => world.rules),
            findUnique: vi.fn(async ({ where }: { where: { id: string } }) => {
                const rule = world.rules.find(r => r.id === where.id) ?? null;
                if (!rule) return null;
                return { ...rule, slots: world.slots.filter(s => s.scheduleRuleId === rule.id) };
            }),
            create: vi.fn(async ({ data }: { data: Partial<RuleRow> }) => {
                const row = { id: `rule-${world.nextId++}`, ...data } as RuleRow;
                world.rules.push(row);
                return row;
            }),
            update: vi.fn(async ({ where, data }: { where: { id: string }; data: Partial<RuleRow> }) => {
                const row = world.rules.find(r => r.id === where.id)!;
                Object.assign(row, data);
                return row;
            }),
            delete: vi.fn(async () => ({})),
        },
        psychologistSettings: { findUnique: vi.fn(async () => ({ defaultSessionDuration: 50 })) },
    },
}));

const { createAvailabilitySlot, updateAvailabilitySlot, createManualSlot } =
    await import('@/app/diary/actions/availability');
const { createScheduleRule, updateScheduleRule, cloneScheduleRule } =
    await import('@/app/diary/actions/schedule-rules');

const RANGE = { startDate: '2026-09-01', endDate: '2026-12-31' };
const MONDAY = 0;

beforeEach(() => {
    world.addresses = [
        { id: 'a-mine-active', psychologistId: 'psy-1', isActive: true },
        { id: 'a-mine-retired', psychologistId: 'psy-1', isActive: false },
        { id: 'a-alien', psychologistId: 'psy-2', isActive: true },
    ];
    world.slots = [];
    world.rules = [];
    world.createdSlots = [];
    world.nextId = 1;
});

describe('окно расписания: кабинет проверяется на сервере', () => {
    it('свой действующий кабинет принимается', async () => {
        const res = await createAvailabilitySlot({
            ...RANGE, daysOfWeek: [MONDAY], startTime: '15:00', endTime: '21:00',
            format: 'offline', addressId: 'a-mine-active',
        });

        expect(res.success).toBe(true);
        expect(world.createdSlots[0].addressId).toBe('a-mine-active');
    });

    it('чужой кабинет отклоняется, окно не создаётся', async () => {
        const res = await createAvailabilitySlot({
            ...RANGE, daysOfWeek: [MONDAY], startTime: '15:00', endTime: '21:00',
            format: 'offline', addressId: 'a-alien',
        });

        expect(res.success).toBe(false);
        expect(res.error).toBe('Кабинет не найден');
        expect(world.slots).toHaveLength(0);
    });

    it('выведенный из работы кабинет отклоняется', async () => {
        const res = await createAvailabilitySlot({
            ...RANGE, daysOfWeek: [MONDAY], startTime: '15:00', endTime: '21:00',
            format: 'offline', addressId: 'a-mine-retired',
        });

        expect(res.success).toBe(false);
        expect(res.error).toContain('выведен из работы');
        expect(world.slots).toHaveLength(0);
    });

    it('очное окно без кабинета отклоняется — встреча без адреса не встреча', async () => {
        const res = await createAvailabilitySlot({
            ...RANGE, daysOfWeek: [MONDAY], startTime: '15:00', endTime: '21:00',
            format: 'offline', addressId: null,
        });

        expect(res.success).toBe(false);
        expect(res.error).toContain('нужно выбрать кабинет');
    });

    it('online + подсунутый кабинет сохраняется как null', async () => {
        const res = await createAvailabilitySlot({
            ...RANGE, daysOfWeek: [MONDAY], startTime: '09:00', endTime: '13:00',
            format: 'online', addressId: 'a-mine-active',
        });

        expect(res.success).toBe(true);
        expect(world.createdSlots[0].addressId).toBeNull();
    });

    it('«онлайн и очно» без кабинета остаётся разрешённым — прежняя семантика продукта', async () => {
        const res = await createAvailabilitySlot({
            ...RANGE, daysOfWeek: [MONDAY], startTime: '09:00', endTime: '13:00',
            format: 'both', addressId: null,
        });

        expect(res.success).toBe(true);
        expect(world.createdSlots[0].addressId).toBeNull();
    });

    it('«онлайн и очно» с чужим кабинетом всё равно отклоняется', async () => {
        const res = await createAvailabilitySlot({
            ...RANGE, daysOfWeek: [MONDAY], startTime: '09:00', endTime: '13:00',
            format: 'both', addressId: 'a-alien',
        });

        expect(res.success).toBe(false);
        expect(world.slots).toHaveLength(0);
    });
});

describe('правка окна проверяется так же, как создание', () => {
    beforeEach(async () => {
        await createAvailabilitySlot({
            ...RANGE, daysOfWeek: [MONDAY], startTime: '15:00', endTime: '21:00',
            format: 'offline', addressId: 'a-mine-active',
        });
    });

    it('перевод окна на выведенный кабинет отклоняется, старый кабинет остаётся', async () => {
        const slot = world.slots[0];

        const res = await updateAvailabilitySlot(slot.id, {
            startTime: '15:00', endTime: '21:00', duration: 50, format: 'offline', addressId: 'a-mine-retired',
        });

        expect(res.success).toBe(false);
        expect(world.slots[0].addressId).toBe('a-mine-active');
    });

    it('перевод окна в онлайн обнуляет кабинет', async () => {
        const slot = world.slots[0];

        const res = await updateAvailabilitySlot(slot.id, {
            startTime: '15:00', endTime: '21:00', duration: 50, format: 'online', addressId: 'a-mine-active',
        });

        expect(res.success).toBe(true);
        expect(world.slots[0].addressId).toBeNull();
    });

    it('createManualSlot закрыт тем же охранником', async () => {
        const alien = await createManualSlot({
            ...RANGE, dayOfWeek: 2, startTime: '10:00', endTime: '12:00', format: 'offline', addressId: 'a-alien',
        });
        expect(alien.success).toBe(false);

        const online = await createManualSlot({
            ...RANGE, dayOfWeek: 3, startTime: '10:00', endTime: '12:00', format: 'online', addressId: 'a-mine-active',
        });
        expect(online.success).toBe(true);
        expect(world.createdSlots.at(-1)!.addressId).toBeNull();
    });
});

describe('правило расписания: тот же охранник', () => {
    it('чужой и выведенный кабинет не принимаются при создании правила', async () => {
        const alien = await createScheduleRule({ name: 'Чужой', format: 'offline', addressId: 'a-alien' });
        expect(alien.success).toBe(false);

        const retired = await createScheduleRule({ name: 'Выведенный', format: 'offline', addressId: 'a-mine-retired' });
        expect(retired.success).toBe(false);

        expect(world.rules).toHaveLength(0);
    });

    it('онлайн-правило не сохраняет подсунутый кабинет', async () => {
        const res = await createScheduleRule({ name: 'Онлайн', format: 'online', addressId: 'a-mine-active' });

        expect(res.success).toBe(true);
        expect(world.rules[0].addressId).toBeNull();
    });

    it('правку правила на выведенный кабинет отклоняем', async () => {
        await createScheduleRule({ name: 'Очное', format: 'offline', addressId: 'a-mine-active' });
        const rule = world.rules[0];

        const res = await updateScheduleRule(rule.id, { addressId: 'a-mine-retired' });

        expect(res.success).toBe(false);
        expect(world.rules[0].addressId).toBe('a-mine-active');
    });

    it('перевод правила в онлайн обнуляет кабинет', async () => {
        await createScheduleRule({ name: 'Очное', format: 'offline', addressId: 'a-mine-active' });
        const rule = world.rules[0];

        const res = await updateScheduleRule(rule.id, { format: 'online' });

        expect(res.success).toBe(true);
        expect(world.rules[0].addressId).toBeNull();
    });

    it('включение правила тумблером кабинет не трогает', async () => {
        await createScheduleRule({ name: 'Очное', format: 'offline', addressId: 'a-mine-active' });
        const rule = world.rules[0];

        const res = await updateScheduleRule(rule.id, { isActive: false });

        expect(res.success).toBe(true);
        expect(world.rules[0].isActive).toBe(false);
        expect(world.rules[0].addressId).toBe('a-mine-active');
    });
});

describe('клонирование правила не оживляет выведенный кабинет', () => {
    it('клон окна на выведенном кабинете не создаётся', async () => {
        const rule = await createScheduleRule({ name: 'Очное', format: 'offline', addressId: 'a-mine-active' });
        const ruleId = (rule.data as { id: string }).id;
        await createAvailabilitySlot({
            ...RANGE, daysOfWeek: [MONDAY], startTime: '15:00', endTime: '21:00',
            format: 'offline', addressId: 'a-mine-active', scheduleRuleId: ruleId,
        });

        // Кабинет вывели из работы уже после того, как правило было создано.
        world.addresses.find(a => a.id === 'a-mine-active')!.isActive = false;
        const slotsBefore = world.slots.length;

        const res = await cloneScheduleRule(ruleId, { name: 'Копия', startDate: '2027-01-01', endDate: '2027-06-30' });

        expect(res.success).toBe(false);
        expect(res.error).toContain('выведен из работы');
        expect(world.slots).toHaveLength(slotsBefore);
    });

    it('клон действующего правила проходит и сохраняет кабинет окна', async () => {
        const rule = await createScheduleRule({ name: 'Очное', format: 'offline', addressId: 'a-mine-active' });
        const ruleId = (rule.data as { id: string }).id;
        await createAvailabilitySlot({
            ...RANGE, daysOfWeek: [MONDAY], startTime: '15:00', endTime: '21:00',
            format: 'offline', addressId: 'a-mine-active', scheduleRuleId: ruleId,
        });

        const res = await cloneScheduleRule(ruleId, { name: 'Копия', startDate: '2027-01-01', endDate: '2027-06-30' });

        expect(res.success).toBe(true);
        expect(world.createdSlots.at(-1)).toMatchObject({ format: 'offline', addressId: 'a-mine-active', isActive: true });
    });
});
