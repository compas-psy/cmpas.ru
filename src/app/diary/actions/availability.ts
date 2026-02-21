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
    startTime: string;
    endTime: string;
    duration?: number;
}) {
    const psychologistId = await getPsychologistId();

    // Parse dates to extract weekday and auto-detect recurrence
    const start = new Date(data.startDate);
    const end = new Date(data.endDate);

    // Convert getDay() (Sun=0) to our format (Mon=0, Sun=6)
    const dayOfWeek = (start.getDay() + 6) % 7;

    // If start and end dates differ, it's a recurring slot across that range
    const isRecurring = start.getTime() !== end.getTime();

    const slot = await db.availabilitySlot.create({
        data: {
            psychologistId,
            dayOfWeek,
            startTime: data.startTime,
            endTime: data.endTime,
            duration: data.duration || 50,
            isRecurring,
            startDate: start,
            endDate: end,
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
