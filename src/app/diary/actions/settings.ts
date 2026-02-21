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
    const psychologistId = await getPsychologistId();
    let settings = await db.psychologistSettings.findUnique({
        where: { psychologistId },
    });
    if (!settings) {
        settings = await db.psychologistSettings.create({
            data: { psychologistId },
        });
    }
    return settings;
}

export async function getAddresses() {
    const psychologistId = await getPsychologistId();
    return db.psychologistAddress.findMany({ where: { psychologistId } });
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
    const psychologistId = await getPsychologistId();
    return db.calendarIntegration.findMany({
        where: { psychologistId },
    });
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
