'use server';

import { db } from '@/lib/db';
import { auth } from '@/auth';
import { revalidatePath } from 'next/cache';
import { getAdsConsentStatus, toggleAdsConsent } from '@/app/legal/actions';
import { requireOwnedCalendarIntegration } from '@/lib/practice/ownership';
import { requirePracticeOperatorAttestation } from '@/lib/practice/attestation';

async function getPsychologistId() {
    const session = await auth();
    if (!session?.user?.id) throw new Error('Unauthorized');
    return session.user.id;
}

export async function getSettings() {
    try {
        const psychologistId = await getPsychologistId();
        let settings = await db.psychologistSettings.findUnique({
            where: { psychologistId },
        });
        if (!settings) {
            settings = await db.psychologistSettings.create({
                data: { psychologistId },
            });
        }
        return { success: true, data: settings };
    } catch (e: any) {
        console.error('getSettings error:', e);
        return { success: false, error: e.message || 'Ошибка при получении настроек' };
    }
}

/**
 * Кабинеты специалиста. По умолчанию — только действующие: выведенный из
 * работы кабинет не должен появляться там, где выбирают место встречи
 * (Задача 18 §5). Экран настроек передаёт includeInactive, потому что он
 * единственный, кому нужно показать выведенные и дать их вернуть.
 */
export async function getAddresses(options?: { includeInactive?: boolean }) {
    try {
        const psychologistId = await getPsychologistId();
        const [addresses, settings] = await Promise.all([
            db.psychologistAddress.findMany({
                where: { psychologistId, ...(options?.includeInactive ? {} : { isActive: true }) },
                orderBy: [{ isActive: 'desc' }, { createdAt: 'asc' }],
            }),
            db.psychologistSettings.findUnique({ where: { psychologistId }, select: { officeAddress: true } }),
        ]);
        // officeAddress stores the primary address ID
        const primaryId = settings?.officeAddress || null;
        return {
            success: true,
            data: addresses.map(a => ({ ...a, isPrimary: a.id === primaryId })),
        };
    } catch (e: any) {
        console.error('getAddresses error:', e);
        return { success: false, error: e.message || 'Ошибка при получении адресов' };
    }
}

export async function createAddress(data: { name: string; address: string }) {
    const psychologistId = await getPsychologistId();
    let settings = await db.psychologistSettings.findUnique({ where: { psychologistId } });
    if (!settings) settings = await db.psychologistSettings.create({ data: { psychologistId } });

    const result = await db.psychologistAddress.create({
        data: { psychologistId, name: data.name, address: data.address }
    });
    // If this is the first address, make it primary
    const count = await db.psychologistAddress.count({ where: { psychologistId } });
    if (count === 1) {
        await db.psychologistSettings.update({
            where: { psychologistId },
            data: { officeAddress: result.id },
        });
    }
    revalidatePath('/diary/settings');
    return result;
}

export async function updateAddress(id: string, data: { name: string; address: string }) {
    const psychologistId = await getPsychologistId();
    const address = await db.psychologistAddress.findFirst({ where: { id, psychologistId }, select: { id: true } });
    if (!address) throw new Error('Кабинет не найден');

    const name = data.name.trim();
    const value = data.address.trim();
    if (!name || !value) throw new Error('Название и адрес кабинета обязательны');

    await db.psychologistAddress.update({ where: { id: address.id }, data: { name, address: value } });
    revalidatePath('/diary/settings');
    revalidatePath('/diary/availability');
    return { success: true as const };
}

/**
 * Сколько ДЕЙСТВУЮЩИХ правил расписания ссылаются на кабинет. Задача 18 §6:
 * пока хоть одно такое правило есть, вывести кабинет из работы нельзя —
 * иначе правило продолжит вести клиентов в место, которого в практике уже
 * нет. Прошедшие сессии сюда не входят: они история, их никто не трогает.
 */
export async function countActiveRulesUsingAddress(addressId: string) {
    const psychologistId = await getPsychologistId();
    const [slots, rules] = await Promise.all([
        db.availabilitySlot.count({ where: { psychologistId, addressId, isActive: true } }),
        db.scheduleRule.count({ where: { psychologistId, addressId, isActive: true } }).catch(() => 0),
    ]);
    return slots + rules;
}

/**
 * Пользовательское «удалить» для кабинета — это вывод из работы, а не
 * удаление строки: у DiarySession.addressId стоит SetNull, и настоящее
 * удаление стёрло бы место встречи у всех прошедших сессий (Задача 18 §5).
 */
export async function deactivateAddress(id: string) {
    const psychologistId = await getPsychologistId();
    const address = await db.psychologistAddress.findFirst({ where: { id, psychologistId }, select: { id: true } });
    if (!address) throw new Error('Кабинет не найден');

    const usedBy = await countActiveRulesUsingAddress(address.id);
    if (usedBy > 0) {
        throw new Error('Сначала измените расписание: кабинет используется в активных правилах.');
    }

    // Основным кабинетом выведенный из работы быть не может.
    const settings = await db.psychologistSettings.findUnique({ where: { psychologistId }, select: { officeAddress: true } });
    if (settings?.officeAddress === id) {
        await db.psychologistSettings.update({ where: { psychologistId }, data: { officeAddress: null } });
    }

    await db.psychologistAddress.update({ where: { id: address.id }, data: { isActive: false } });
    revalidatePath('/diary/settings');
    revalidatePath('/diary/availability');
    return { success: true as const };
}

/** Вернуть кабинет в работу. Ничего не восстанавливает — просто снимает вывод. */
export async function activateAddress(id: string) {
    const psychologistId = await getPsychologistId();
    const address = await db.psychologistAddress.findFirst({ where: { id, psychologistId }, select: { id: true } });
    if (!address) throw new Error('Кабинет не найден');

    await db.psychologistAddress.update({ where: { id: address.id }, data: { isActive: true } });
    revalidatePath('/diary/settings');
    revalidatePath('/diary/availability');
    return { success: true as const };
}

export async function setPrimaryAddress(addressId: string) {
    const psychologistId = await getPsychologistId();
    const address = await db.psychologistAddress.findFirst({ where: { id: addressId, psychologistId }, select: { id: true, isActive: true } });
    if (!address) throw new Error('Кабинет не найден');
    if (!address.isActive) throw new Error('Кабинет выведен из работы — сначала верните его');

    await db.psychologistSettings.upsert({
        where: { psychologistId },
        create: { psychologistId, officeAddress: address.id },
        update: { officeAddress: address.id },
    });
    revalidatePath('/diary/settings');
}

export async function updateSettings(data: {
    timezone?: string;
    defaultSessionDuration?: number;
    sessionBreak?: number;
    onlineSessionLink?: string;
    officeAddress?: string;
    cancellationHours?: number;
    cancellationFee?: number;
    cancellationText?: string;
    autoSync?: boolean;
    blockConflicts?: boolean;
    notifyTelegram?: boolean;
    notifyAds?: boolean;
    timeFormat?: string;
    dateFormat?: string;
    weekStartsOn?: string;
    scheduleMode?: string;
    maxSessionsPerDay?: number | null;
    bookingHorizonDays?: number;
    bookingBufferHours?: number;
}) {
    const psychologistId = await getPsychologistId();
    // Task 5: turning on public self-booking exposes a psychologist's slots
    // to strangers who can create client records of themselves — same
    // "gate the next client creation" rule as createClient/bulkCreateClients.
    if (data.scheduleMode === 'booking') {
        await requirePracticeOperatorAttestation(psychologistId);
    }
    const safeData = {
        ...(typeof data.timezone === 'string' ? { timezone: data.timezone } : {}),
        ...(typeof data.defaultSessionDuration === 'number' ? { defaultSessionDuration: data.defaultSessionDuration } : {}),
        ...(typeof data.sessionBreak === 'number' ? { sessionBreak: data.sessionBreak } : {}),
        ...(typeof data.onlineSessionLink === 'string' ? { onlineSessionLink: data.onlineSessionLink.trim() || null } : {}),
        ...(typeof data.officeAddress === 'string' ? { officeAddress: data.officeAddress || null } : {}),
        ...(typeof data.cancellationHours === 'number' ? { cancellationHours: Math.max(0, data.cancellationHours) } : {}),
        ...(typeof data.cancellationFee === 'number' ? { cancellationFee: Math.min(100, Math.max(0, data.cancellationFee)) } : {}),
        ...(typeof data.cancellationText === 'string' ? { cancellationText: data.cancellationText } : {}),
        ...(typeof data.autoSync === 'boolean' ? { autoSync: data.autoSync } : {}),
        ...(typeof data.blockConflicts === 'boolean' ? { blockConflicts: data.blockConflicts } : {}),
        ...(typeof data.scheduleMode === 'string' ? { scheduleMode: data.scheduleMode } : {}),
        ...(typeof data.maxSessionsPerDay === 'number' || data.maxSessionsPerDay === null ? { maxSessionsPerDay: data.maxSessionsPerDay } : {}),
        ...(typeof data.bookingHorizonDays === 'number' ? { bookingHorizonDays: data.bookingHorizonDays } : {}),
        ...(typeof data.bookingBufferHours === 'number' ? { bookingBufferHours: data.bookingBufferHours } : {}),
    };

    const settings = await db.psychologistSettings.upsert({
        where: { psychologistId },
        create: { psychologistId, ...safeData },
        update: safeData,
    });
    revalidatePath('/diary/settings');
    return settings;
}

export async function getIntegrations() {
    try {
        const psychologistId = await getPsychologistId();
        const integrations = await db.calendarIntegration.findMany({
            where: { psychologistId },
        });
        return { success: true, data: integrations };
    } catch (e: any) {
        console.error('getIntegrations error:', e);
        return { success: false, error: e.message || 'Ошибка при получении интеграций' };
    }
}

export async function toggleIntegration(id: string, isActive: boolean) {
    const psychologistId = await getPsychologistId();
    await requireOwnedCalendarIntegration(psychologistId, id);
    const integration = await db.calendarIntegration.update({
        where: { id },
        data: { isActive },
    });
    revalidatePath('/diary/integrations');
    return integration;
}

export async function toggleIntegrationSyncFrom(id: string, syncFrom: boolean) {
    const psychologistId = await getPsychologistId();
    await requireOwnedCalendarIntegration(psychologistId, id);
    // @ts-ignore: syncFrom is added to schema but prisma generate failed due to db connection
    const integration = await db.calendarIntegration.update({
        where: { id },
        data: { syncFrom },
    });
    revalidatePath('/diary/integrations');
    return integration;
}

export async function disconnectIntegration(id: string) {
    const psychologistId = await getPsychologistId();
    await requireOwnedCalendarIntegration(psychologistId, id);
    await db.calendarIntegration.delete({
        where: { id },
    });
    revalidatePath('/diary/integrations');
}

export async function getMessengerStatus() {
    try {
        const psychologistId = await getPsychologistId();
        const user = await (db as any).user.findUnique({
            where: { id: psychologistId },
            select: { telegramChatId: true, telegramUsername: true, maxChatId: true },
        });
        return {
            success: true,
            data: {
                telegramLinked: !!user?.telegramChatId,
                telegramUsername: user?.telegramUsername || null,
                maxLinked: !!user?.maxChatId,
            },
        };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

export async function unlinkTelegramAccount() {
    const psychologistId = await getPsychologistId();
    await db.user.update({
        where: { id: psychologistId },
        data: { telegramChatId: null, telegramUsername: null },
    });
    revalidatePath('/diary/integrations');
    return { success: true };
}

export async function linkTelegramAccount(telegramChatId: string, telegramUsername?: string) {
    const psychologistId = await getPsychologistId();
    await db.user.update({
        where: { id: psychologistId },
        data: {
            telegramChatId: telegramChatId.toString(),
            telegramUsername
        },
    });
    revalidatePath('/diary/integrations');
    return { success: true };
}

export async function linkMaxAccount(maxChatId: string) {
    const psychologistId = await getPsychologistId();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (db as any).user.update({
        where: { id: psychologistId },
        data: { maxChatId: maxChatId.toString() },
    });
    revalidatePath('/diary/integrations');
    return { success: true };
}

export async function unlinkMaxAccount() {
    const psychologistId = await getPsychologistId();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (db as any).user.update({
        where: { id: psychologistId },
        data: { maxChatId: null },
    });
    revalidatePath('/diary/integrations');
    return { success: true };
}

export async function getProfile() {
    try {
        const psychologistId = await getPsychologistId();
        const user = await db.user.findUnique({ where: { id: psychologistId } });
        const settings = await db.psychologistSettings.findUnique({ where: { psychologistId } });

        if (!user) throw new Error('User not found');

        return {
            success: true,
            data: {
                fullName: user.name || '',
                email: user.email || '',
                image: user.image || null,
                methods: (settings as any)?.methods || [],
                basePrice: (settings as any)?.basePrice || null,
            }
        };
    } catch (e: any) {
        console.error('getProfile error:', e);
        return { success: false, error: e.message || 'Ошибка' };
    }
}

export async function updateProfile(data: {
    fullName?: string;
    methods?: string[];
    basePrice?: number | null;
}) {
    const psychologistId = await getPsychologistId();

    if (data.fullName !== undefined) {
        await db.user.update({
            where: { id: psychologistId },
            data: { name: data.fullName },
        });
    }

    // methods/basePrice — upsert into settings
    const settingsData: any = {};
    if (data.methods !== undefined) settingsData.methods = data.methods;
    if (data.basePrice !== undefined) settingsData.basePrice = data.basePrice;

    if (Object.keys(settingsData).length > 0) {
        await db.psychologistSettings.upsert({
            where: { psychologistId },
            create: { psychologistId, ...settingsData },
            update: settingsData,
        });
    }

    revalidatePath('/diary/profile');
    revalidatePath('/diary/settings');
    return { success: true };
}

export async function getAdsConsentForUser() {
    await getPsychologistId(); // ensures caller is authenticated before delegating
    return getAdsConsentStatus();
}

export async function toggleAdsConsentForUser(accept: boolean) {
    await getPsychologistId();
    return toggleAdsConsent(accept);
}

export async function getTrialStatus() {
    try {
        const userId = await getPsychologistId();
        // Use raw SQL so this works even if trialEndsAt column doesn't exist yet
        const rows = await db.$queryRaw<{ trialEndsAt: Date | null }[]>`
            SELECT "trialEndsAt" FROM "User" WHERE id = ${userId} LIMIT 1
        `;
        const trialEndsAt = rows[0]?.trialEndsAt ?? null;
        if (!trialEndsAt) return { daysLeft: null };
        const diff = trialEndsAt.getTime() - Date.now();
        const daysLeft = Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
        return { daysLeft };
    } catch {
        return { daysLeft: null };
    }
}
