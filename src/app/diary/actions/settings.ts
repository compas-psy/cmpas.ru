'use server';

import { db } from '@/lib/db';
import { auth } from '@/auth';
import { revalidatePath } from 'next/cache';

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
        const addresses = await db.psychologistAddress.findMany({ where: { psychologistId } });
        return { success: true, data: addresses };
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
    revalidatePath('/diary/settings');
    return result;
}

export async function deleteAddress(id: string) {
    await getPsychologistId();
    await db.psychologistAddress.delete({ where: { id } });
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

export async function disconnectIntegration(id: string) {
    await getPsychologistId();
    await db.calendarIntegration.delete({
        where: { id },
    });
    revalidatePath('/diary/integrations');
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
