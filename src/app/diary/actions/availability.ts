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
    date: string;
    startTime: string;
    endTime: string;
    duration?: number;
    isRecurring?: boolean;
}) {
    const psychologistId = await getPsychologistId();
    const dateObj = new Date(data.date);
    const dayOfWeek = (dateObj.getDay() + 6) % 7; // Convert to Mon=0

    const slot = await db.availabilitySlot.create({
        data: {
            psychologistId,
            dayOfWeek,
            startTime: data.startTime,
            endTime: data.endTime,
            duration: data.duration || 50,
            isRecurring: data.isRecurring ?? false,
            specificDate: data.isRecurring ? null : dateObj,
        },
    });
    revalidatePath('/diary/availability');
    return slot;
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
