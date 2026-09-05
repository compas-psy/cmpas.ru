import { db } from '@/lib/db';
import { OwnershipError } from './ownership';

/**
 * Кабинеты практики — одно ядро на веб и приложение (Задача 21).
 *
 * До этого правила жили только в серверных действиях веб-кабинета
 * (src/app/diary/actions/settings.ts). Приложению нужен тот же набор
 * операций, а дублировать их значило бы завести вторую, расходящуюся
 * трактовку «можно ли вывести кабинет из работы» — то есть рано или поздно
 * получить кабинет, который из приложения выводится, а из веба нет.
 *
 * Что здесь важно и почему:
 *
 *   • Основной кабинет хранится не флагом в строке кабинета, а ссылкой
 *     PsychologistSettings.officeAddress. Так исторически, и менять это
 *     ради Задачи 21 нельзя: на officeAddress завязаны другие места.
 *   • «Удалить» кабинет = вывести из работы. У DiarySession.addressId стоит
 *     SetNull: настоящее удаление стёрло бы место встречи у всех прошедших
 *     сессий (Задача 18 §5).
 *   • Вывести кабинет нельзя, пока на него ссылается будущее: назначенные
 *     сессии и действующие правила расписания. Молча переносить их в другое
 *     место — то же враньё, что и молча удалять.
 */

/** Кабинет в том виде, в каком его показывают специалисту. */
export type PracticeAddress = {
    id: string;
    name: string;
    address: string;
    isPrimary: boolean;
    isActive: boolean;
};

/** Что именно держит кабинет. Ноль в обоих полях — кабинет свободен. */
export type AddressBlockers = {
    futureSessions: number;
    activeSchedule: number;
};

/**
 * Кабинет занят: вывести его из работы нельзя, пока специалист сам не
 * разберётся с зависимостями. Отдельный класс, потому что веб и приложение
 * сообщают об этом по-разному (текст ошибки против 409 ADDRESS_IN_USE), а
 * причина одна.
 */
export class AddressInUseError extends Error {
    readonly blockers: AddressBlockers;

    constructor(blockers: AddressBlockers) {
        super(addressInUseMessage(blockers));
        this.name = 'AddressInUseError';
        this.blockers = blockers;
    }
}

/**
 * Причина называет действие, а не состояние мира: специалисту надо понять,
 * что именно перенести, чтобы кабинет освободился.
 */
export function addressInUseMessage(blockers: AddressBlockers): string {
    if (blockers.activeSchedule > 0 && blockers.futureSessions > 0) {
        return 'Сначала измените расписание и перенесите будущие записи: кабинет ещё используется.';
    }
    if (blockers.activeSchedule > 0) {
        return 'Сначала измените расписание: кабинет используется в активных правилах.';
    }
    return 'Сначала перенесите будущие записи: они назначены в этом кабинете.';
}

/** Ссылка на основной кабинет. Её держит PsychologistSettings, а не сам кабинет. */
async function readPrimaryId(psychologistId: string): Promise<string | null> {
    const settings = await db.psychologistSettings.findUnique({
        where: { psychologistId },
        select: { officeAddress: true },
    });
    return settings?.officeAddress || null;
}

async function requireOwnAddress(psychologistId: string, addressId: string) {
    const address = await db.psychologistAddress.findFirst({
        where: { id: addressId, psychologistId },
        select: { id: true, isActive: true },
    });
    // Сообщение намеренно такое же, как у настоящего «не найдено»: знание о
    // том, что кабинет существует, но чужой, — тоже утечка (Задача 1).
    if (!address) throw new OwnershipError('Кабинет не найден');
    return address;
}

/**
 * Кабинеты специалиста. По умолчанию — только действующие: выведенный из
 * работы кабинет не должен появляться там, где выбирают место встречи.
 */
export async function listPracticeAddresses(
    psychologistId: string,
    options?: { includeInactive?: boolean },
): Promise<PracticeAddress[]> {
    const [addresses, primaryId] = await Promise.all([
        db.psychologistAddress.findMany({
            where: { psychologistId, ...(options?.includeInactive ? {} : { isActive: true }) },
            orderBy: [{ isActive: 'desc' }, { createdAt: 'asc' }],
            select: { id: true, name: true, address: true, isActive: true },
        }),
        readPrimaryId(psychologistId),
    ]);

    return addresses.map((a) => ({ ...a, isPrimary: a.id === primaryId }));
}

/**
 * Создание кабинета. Первый созданный становится основным: практика с
 * единственным кабинетом не должна требовать отдельного действия «сделать
 * основным», иначе место встречи нигде не подставится.
 */
export async function createPracticeAddress(
    psychologistId: string,
    data: { name: string; address: string },
): Promise<PracticeAddress> {
    const name = data.name?.trim() ?? '';
    const address = data.address?.trim() ?? '';
    if (!name || !address) throw new OwnershipError('Название и адрес кабинета обязательны');

    const created = await db.psychologistAddress.create({
        data: { psychologistId, name, address },
        select: { id: true, name: true, address: true, isActive: true },
    });

    const count = await db.psychologistAddress.count({ where: { psychologistId } });
    let isPrimary = false;
    if (count === 1) {
        await db.psychologistSettings.upsert({
            where: { psychologistId },
            create: { psychologistId, officeAddress: created.id },
            update: { officeAddress: created.id },
        });
        isPrimary = true;
    } else {
        isPrimary = (await readPrimaryId(psychologistId)) === created.id;
    }

    return { ...created, isPrimary };
}

/** Переименование и смена адреса. Больше через эту дверь ничего не меняется. */
export async function updatePracticeAddress(
    psychologistId: string,
    addressId: string,
    data: { name?: string; address?: string },
): Promise<PracticeAddress> {
    const existing = await requireOwnAddress(psychologistId, addressId);

    const patch: { name?: string; address?: string } = {};
    if (data.name !== undefined) {
        const name = data.name.trim();
        if (!name) throw new OwnershipError('Название и адрес кабинета обязательны');
        patch.name = name;
    }
    if (data.address !== undefined) {
        const value = data.address.trim();
        if (!value) throw new OwnershipError('Название и адрес кабинета обязательны');
        patch.address = value;
    }
    if (Object.keys(patch).length === 0) throw new OwnershipError('Нечего менять');

    const updated = await db.psychologistAddress.update({
        where: { id: existing.id },
        data: patch,
        select: { id: true, name: true, address: true, isActive: true },
    });
    return { ...updated, isPrimary: (await readPrimaryId(psychologistId)) === updated.id };
}

/** Основным может быть только свой кабинет и только тот, что в работе. */
export async function setPrimaryPracticeAddress(psychologistId: string, addressId: string): Promise<void> {
    const address = await requireOwnAddress(psychologistId, addressId);
    if (!address.isActive) throw new OwnershipError('Кабинет выведен из работы — сначала верните его');

    await db.psychologistSettings.upsert({
        where: { psychologistId },
        create: { psychologistId, officeAddress: address.id },
        update: { officeAddress: address.id },
    });
}

/**
 * Что держит кабинет в работе.
 *
 * Будущие сессии — назначенные и ещё не прошедшие: отменённые и завершённые
 * уже история, они кабинет не держат. Прошедшие сессии не считаются
 * никогда — иначе кабинет нельзя было бы вывести вообще.
 *
 * Правила расписания — и окна (AvailabilitySlot), и правила (ScheduleRule),
 * но только действующие: выключенное правило клиентов никуда не ведёт.
 */
export async function findAddressBlockers(
    psychologistId: string,
    addressId: string,
    now: Date = new Date(),
): Promise<AddressBlockers> {
    const [futureSessions, slots, rules] = await Promise.all([
        db.diarySession.count({
            where: {
                psychologistId,
                addressId,
                date: { gte: now },
                status: { in: ['pending', 'confirmed'] },
            },
        }),
        db.availabilitySlot.count({ where: { psychologistId, addressId, isActive: true } }),
        db.scheduleRule.count({ where: { psychologistId, addressId, isActive: true } }).catch(() => 0),
    ]);

    return { futureSessions, activeSchedule: slots + rules };
}

/**
 * Пользовательское «удалить» для кабинета — вывод из работы.
 *
 * Строка остаётся в БД: у прошедших сессий место встречи сохраняется.
 * Никакого молчаливого переназначения зависимостей: пока кабинет занят,
 * операция не проходит и ничего не меняет.
 */
export async function deactivatePracticeAddress(
    psychologistId: string,
    addressId: string,
    now: Date = new Date(),
): Promise<void> {
    const address = await requireOwnAddress(psychologistId, addressId);

    const blockers = await findAddressBlockers(psychologistId, address.id, now);
    if (blockers.futureSessions > 0 || blockers.activeSchedule > 0) {
        throw new AddressInUseError(blockers);
    }

    // Основным выведенный из работы кабинет быть не может.
    if ((await readPrimaryId(psychologistId)) === address.id) {
        await db.psychologistSettings.update({
            where: { psychologistId },
            data: { officeAddress: null },
        });
    }

    await db.psychologistAddress.update({ where: { id: address.id }, data: { isActive: false } });
}

/** Вернуть кабинет в работу. Ничего не восстанавливает — просто снимает вывод. */
export async function activatePracticeAddress(psychologistId: string, addressId: string): Promise<void> {
    const address = await requireOwnAddress(psychologistId, addressId);
    await db.psychologistAddress.update({ where: { id: address.id }, data: { isActive: true } });
}
