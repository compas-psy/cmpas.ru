'use server';

import { db } from '@/lib/db';
import { auth } from '@/auth';
import { revalidatePath } from 'next/cache';

async function getPsychologistId() {
    const session = await auth();
    if (!session?.user?.id) throw new Error('Unauthorized');
    return session.user.id;
}

export async function getAvailabilitySlots() {
    const psychologistId = await getPsychologistId();
    return db.availabilitySlot.findMany({
        where: { psychologistId, isActive: true },
        orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
    });
}

export async function createAvailabilitySlot(data: {
    startDate: string;
    endDate: string;
    daysOfWeek: number[];
    startTime: string;
    endTime: string;
    duration?: number;
    hasLunch?: boolean;
    lunchStart?: string;
    lunchEnd?: string;
    format?: string;
    addressId?: string | null;
}) {
    const psychologistId = await getPsychologistId();
    const start = new Date(data.startDate);
    const end = new Date(data.endDate);
    const isRecurring = start.getTime() !== end.getTime();

    const slotsToCreate = [];

    for (const dayOfWeek of data.daysOfWeek) {
        if (data.hasLunch && data.lunchStart && data.lunchEnd) {
            // Before lunch
            slotsToCreate.push({
                psychologistId, dayOfWeek,
                startTime: data.startTime, endTime: data.lunchStart,
                duration: data.duration || 50, isRecurring, startDate: start, endDate: end,
                format: data.format || 'online', addressId: data.addressId || null
            });
            // After lunch
            slotsToCreate.push({
                psychologistId, dayOfWeek,
                startTime: data.lunchEnd, endTime: data.endTime,
                duration: data.duration || 50, isRecurring, startDate: start, endDate: end,
                format: data.format || 'online', addressId: data.addressId || null
            });
        } else {
            // Full day
            slotsToCreate.push({
                psychologistId, dayOfWeek,
                startTime: data.startTime, endTime: data.endTime,
                duration: data.duration || 50, isRecurring, startDate: start, endDate: end,
                format: data.format || 'online', addressId: data.addressId || null
            });
        }
    }

    if (slotsToCreate.length > 0) {
        await db.availabilitySlot.createMany({
            data: slotsToCreate
        });
    }

    revalidatePath('/diary/availability');
    return { success: true };
}

export async function deleteAvailabilitySlot(id: string) {
    await getPsychologistId();
    await db.availabilitySlot.delete({ where: { id } });
    revalidatePath('/diary/availability');
}

export async function getTimeBlocks() {
    const psychologistId = await getPsychologistId();
    return db.timeBlock.findMany({
        where: { psychologistId },
        orderBy: { startDate: 'desc' },
    });
}

export async function createTimeBlock(data: {
    startDate: string;
    endDate: string;
    type: string;
    reason?: string;
}) {
    const psychologistId = await getPsychologistId();
    const block = await db.timeBlock.create({
        data: {
            psychologistId,
            startDate: new Date(data.startDate),
            endDate: new Date(data.endDate),
            type: data.type,
            reason: data.reason || null,
        },
    });
    revalidatePath('/diary/availability');
    return block;
}

export async function deleteTimeBlock(id: string) {
    await getPsychologistId();
    await db.timeBlock.delete({ where: { id } });
    revalidatePath('/diary/availability');
}
