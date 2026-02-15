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

export async function updateSettings(data: {
    timezone?: string;
    defaultSessionDuration?: number;
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
