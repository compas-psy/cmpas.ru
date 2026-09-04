// Задача 18 §5/§6 — кабинет выводят из работы, а не удаляют.
//
// Смысл проверки: у DiarySession.addressId стоит onDelete: SetNull, поэтому
// настоящее удаление строки кабинета стёрло бы место встречи у всех прошедших
// сессий. И пока на кабинет ссылается хотя бы одно ДЕЙСТВУЮЩЕЕ правило
// расписания, выводить его нельзя — иначе правило продолжит вести клиентов
// туда, где приёма уже нет.

import { describe, it, expect, vi, beforeEach } from 'vitest';

type AddressRow = { id: string; psychologistId: string; name: string; address: string; isActive: boolean };

const world = vi.hoisted(() => ({
    addresses: [] as AddressRow[],
    /** Действующие окна расписания: addressId → сколько ссылается. */
    activeSlots: [] as Array<{ psychologistId: string; addressId: string | null; isActive: boolean }>,
    activeRules: [] as Array<{ psychologistId: string; addressId: string | null; isActive: boolean }>,
    /** Прошедшие сессии — их не должен трогать никто. */
    sessions: [] as Array<{ id: string; addressId: string | null }>,
    officeAddress: null as string | null,
    deletedAddressIds: [] as string[],
}));

vi.mock('@/auth', () => ({ auth: vi.fn(async () => ({ user: { id: 'psy-1' } })) }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

vi.mock('@/lib/db', () => ({
    db: {
        psychologistAddress: {
            findFirst: vi.fn(async ({ where }: { where: { id: string; psychologistId: string } }) =>
                world.addresses.find(a => a.id === where.id && a.psychologistId === where.psychologistId) ?? null),
            findMany: vi.fn(async ({ where }: { where: { psychologistId: string; isActive?: boolean } }) =>
                world.addresses.filter(a => a.psychologistId === where.psychologistId
                    && (where.isActive === undefined || a.isActive === where.isActive))),
            update: vi.fn(async ({ where, data }: { where: { id: string }; data: Partial<AddressRow> }) => {
                const row = world.addresses.find(a => a.id === where.id)!;
                Object.assign(row, data);
                return row;
            }),
            // Настоящее удаление обнулило бы адрес у прошедших сессий — именно
            // поэтому его быть не должно; фиксируем каждый вызов.
            delete: vi.fn(async ({ where }: { where: { id: string } }) => {
                world.deletedAddressIds.push(where.id);
                world.addresses = world.addresses.filter(a => a.id !== where.id);
                for (const session of world.sessions) {
                    if (session.addressId === where.id) session.addressId = null;
                }
                return { id: where.id };
            }),
            count: vi.fn(async () => world.addresses.length),
        },
        availabilitySlot: {
            count: vi.fn(async ({ where }: { where: { psychologistId: string; addressId: string; isActive: boolean } }) =>
                world.activeSlots.filter(s => s.psychologistId === where.psychologistId
                    && s.addressId === where.addressId && s.isActive === where.isActive).length),
        },
        scheduleRule: {
            count: vi.fn(async ({ where }: { where: { psychologistId: string; addressId: string; isActive: boolean } }) =>
                world.activeRules.filter(r => r.psychologistId === where.psychologistId
                    && r.addressId === where.addressId && r.isActive === where.isActive).length),
        },
        psychologistSettings: {
            findUnique: vi.fn(async () => ({ officeAddress: world.officeAddress })),
            update: vi.fn(async ({ data }: { data: { officeAddress: string | null } }) => {
                world.officeAddress = data.officeAddress;
                return { officeAddress: world.officeAddress };
            }),
            upsert: vi.fn(async ({ update }: { update: { officeAddress: string } }) => {
                world.officeAddress = update.officeAddress;
                return { officeAddress: world.officeAddress };
            }),
            create: vi.fn(async () => ({ officeAddress: null })),
        },
    },
}));

const { getAddresses, deactivateAddress, activateAddress, updateAddress, setPrimaryAddress } =
    await import('@/app/diary/actions/settings');

beforeEach(() => {
    world.addresses = [
        { id: 'a-yauzskaya', psychologistId: 'psy-1', name: 'Яузская', address: 'ул. Яузская, 5', isActive: true },
        { id: 'a-kurkino', psychologistId: 'psy-1', name: 'Куркино', address: 'ул. Соловьиная роща, 1', isActive: true },
    ];
    world.activeSlots = [];
    world.activeRules = [];
    world.sessions = [{ id: 's-past', addressId: 'a-yauzskaya' }];
    world.officeAddress = 'a-yauzskaya';
    world.deletedAddressIds = [];
});

describe('§6 вывод кабинета, на который ссылаются активные правила', () => {
    it('блокируется с понятной причиной', async () => {
        world.activeSlots = [{ psychologistId: 'psy-1', addressId: 'a-yauzskaya', isActive: true }];

        await expect(deactivateAddress('a-yauzskaya'))
            .rejects.toThrow('Сначала измените расписание: кабинет используется в активных правилах.');

        // Ничего не изменилось и ничего не переназначилось молча.
        expect(world.addresses.find(a => a.id === 'a-yauzskaya')!.isActive).toBe(true);
        expect(world.activeSlots[0].addressId).toBe('a-yauzskaya');
    });

    it('правило уровня ScheduleRule держит кабинет так же, как окно', async () => {
        world.activeRules = [{ psychologistId: 'psy-1', addressId: 'a-yauzskaya', isActive: true }];
        await expect(deactivateAddress('a-yauzskaya')).rejects.toThrow(/Сначала измените расписание/);
    });

    it('после переназначения правил вывод проходит', async () => {
        world.activeSlots = [{ psychologistId: 'psy-1', addressId: 'a-yauzskaya', isActive: true }];
        await expect(deactivateAddress('a-yauzskaya')).rejects.toThrow();

        // Специалист перевёл окно на другой кабинет — путь открыт.
        world.activeSlots[0].addressId = 'a-kurkino';
        await expect(deactivateAddress('a-yauzskaya')).resolves.toEqual({ success: true });
        expect(world.addresses.find(a => a.id === 'a-yauzskaya')!.isActive).toBe(false);
    });

    it('выключенное правило кабинет не держит', async () => {
        world.activeSlots = [{ psychologistId: 'psy-1', addressId: 'a-yauzskaya', isActive: false }];
        await expect(deactivateAddress('a-yauzskaya')).resolves.toEqual({ success: true });
    });
});

describe('§5 вывод из работы — не разрушение истории', () => {
    it('строка кабинета остаётся, прошедшая сессия сохраняет свой адрес', async () => {
        await deactivateAddress('a-yauzskaya');

        expect(world.deletedAddressIds).toEqual([]);
        expect(world.addresses.map(a => a.id)).toContain('a-yauzskaya');
        expect(world.sessions[0].addressId).toBe('a-yauzskaya');
    });

    it('выведенный кабинет перестаёт быть основным', async () => {
        await deactivateAddress('a-yauzskaya');
        expect(world.officeAddress).toBeNull();
    });

    it('выведенный кабинет нельзя назначить основным, пока не вернули', async () => {
        await deactivateAddress('a-yauzskaya');
        await expect(setPrimaryAddress('a-yauzskaya')).rejects.toThrow(/выведен из работы/);

        await activateAddress('a-yauzskaya');
        await expect(setPrimaryAddress('a-yauzskaya')).resolves.toBeUndefined();
        expect(world.officeAddress).toBe('a-yauzskaya');
    });

    it('вернуть кабинет в работу можно', async () => {
        await deactivateAddress('a-yauzskaya');
        await activateAddress('a-yauzskaya');
        expect(world.addresses.find(a => a.id === 'a-yauzskaya')!.isActive).toBe(true);
    });
});

describe('видимость кабинетов', () => {
    it('по умолчанию выбор показывает только действующие кабинеты', async () => {
        await deactivateAddress('a-yauzskaya');

        const res = await getAddresses();
        expect(res.success).toBe(true);
        expect(res.data!.map(a => a.id)).toEqual(['a-kurkino']);
    });

    it('настройки видят и выведенные — чтобы их можно было вернуть', async () => {
        await deactivateAddress('a-yauzskaya');

        const res = await getAddresses({ includeInactive: true });
        expect(res.data!.map(a => a.id).sort()).toEqual(['a-kurkino', 'a-yauzskaya']);
    });

    it('чужой кабинет не найти и не тронуть', async () => {
        world.addresses.push({ id: 'a-alien', psychologistId: 'psy-2', name: 'Чужой', address: '—', isActive: true });

        await expect(deactivateAddress('a-alien')).rejects.toThrow('Кабинет не найден');
        await expect(updateAddress('a-alien', { name: 'Взлом', address: 'Взлом' })).rejects.toThrow('Кабинет не найден');
        expect(world.addresses.find(a => a.id === 'a-alien')!.name).toBe('Чужой');
    });
});

describe('§4 редактирование кабинета', () => {
    it('меняет название и адрес', async () => {
        await updateAddress('a-yauzskaya', { name: 'Яузская, 2 этаж', address: 'ул. Яузская, 5, каб. 12' });

        const row = world.addresses.find(a => a.id === 'a-yauzskaya')!;
        expect(row.name).toBe('Яузская, 2 этаж');
        expect(row.address).toBe('ул. Яузская, 5, каб. 12');
    });

    it('пустое название или адрес не сохраняются', async () => {
        await expect(updateAddress('a-yauzskaya', { name: '  ', address: 'ул. Яузская, 5' })).rejects.toThrow(/обязательны/);
        expect(world.addresses.find(a => a.id === 'a-yauzskaya')!.name).toBe('Яузская');
    });
});
