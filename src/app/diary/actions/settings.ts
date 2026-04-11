'use server';

import { db } from '@/lib/db';
import { auth } from '@/auth';
import { revalidatePath } from 'next/cache';
import { getAdsConsentStatus, toggleAdsConsent } from '@/app/legal/actions';

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

export async function getAddresses() {
    try {
        const psychologistId = await getPsychologistId();
        const [addresses, settings] = await Promise.all([
            db.psychologistAddress.findMany({ where: { psychologistId } }),
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

export async function deleteAddress(id: string) {
    const psychologistId = await getPsychologistId();
    // If deleting primary, clear it
    const settings = await db.psychologistSettings.findUnique({ where: { psychologistId }, select: { officeAddress: true } });
    if (settings?.officeAddress === id) {
        await db.psychologistSettings.update({ where: { psychologistId }, data: { officeAddress: null } });
    }
    await db.psychologistAddress.delete({ where: { id } });
    revalidatePath('/diary/settings');
}

export async function setPrimaryAddress(addressId: string) {
    const psychologistId = await getPsychologistId();
    await db.psychologistSettings.update({
        where: { psychologistId },
        data: { officeAddress: addressId },
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
    scheduleMode?: string;
    maxSessionsPerDay?: number | null;
}) {
    const psychologistId = await getPsychologistId();
    const settings = await db.psychologistSettings.upsert({
        where: { psychologistId },
        create: { psychologistId, ...data },
        update: data,
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
    await getPsychologistId();
    const integration = await db.calendarIntegration.update({
        where: { id },
        data: { isActive },
    });
    revalidatePath('/diary/integrations');
    return integration;
}

export async function toggleIntegrationSyncFrom(id: string, syncFrom: boolean) {
    await getPsychologistId();
    // @ts-ignore: syncFrom is added to schema but prisma generate failed due to db connection
    const integration = await db.calendarIntegration.update({
        where: { id },
        data: { syncFrom },
    });
    revalidatePath('/diary/integrations');
    return integration;
}

export async function disconnectIntegration(id: string) {
    await getPsychologistId();
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
    const userId = await getPsychologistId();
    return getAdsConsentStatus(userId);
}

export async function toggleAdsConsentForUser(accept: boolean) {
    const userId = await getPsychologistId();
    return toggleAdsConsent(userId, accept);
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
