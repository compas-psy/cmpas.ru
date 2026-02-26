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

export async function updateAvailabilitySlot(id: string, data: {
    startTime: string;
    endTime: string;
    duration: number;
    format: string;
    addressId?: string | null;
}) {
    const psychologistId = await getPsychologistId();
    // Only allow updating owned slots
    const existing = await db.availabilitySlot.findUnique({ where: { id } });
    if (!existing || existing.psychologistId !== psychologistId) {
        throw new Error('Unauthorized');
    }

    await db.availabilitySlot.update({
        where: { id },
        data: {
            startTime: data.startTime,
            endTime: data.endTime,
            duration: data.duration,
            format: data.format,
            addressId: data.addressId || null,
        }
    });
    revalidatePath('/diary/availability');
}

export async function getTimeBlocks() {
    const psychologistId = await getPsychologistId();
    // Возвращаем все блоки, трансформируя их обратно в startDate / endDate для UI (упрощенно: каждый блок = отдельная запись, UI поймет, если мы отдадим startDate=date, endDate=date)
    const blocks = await db.diaryBlock.findMany({
        where: { psychologistId },
        orderBy: { date: 'desc' },
    });

    return blocks.map(b => ({
        id: b.id,
        startDate: b.date,
        endDate: b.date,
        type: b.type,
        reason: b.reason
    }));
}

export async function createTimeBlock(data: {
    startDate: string;
    endDate: string;
    type: string;
    reason?: string;
    cancelIntersectingSessions?: boolean;
}) {
    const psychologistId = await getPsychologistId();

    const start = new Date(data.startDate);
    const end = new Date(data.endDate);
    const blocksToCreate = [];

    // Создаем блоки на каждый день от startDate до endDate
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        blocksToCreate.push({
            psychologistId,
            date: new Date(d),
            startTime: '00:00',
            endTime: '23:59',
            type: data.type,
            reason: data.reason || null,
        });
    }

    await db.diaryBlock.createMany({
        data: blocksToCreate
    });

    if (data.cancelIntersectingSessions) {
        // Find and cancel all intersecting sessions in this range
        const sessionsToCancel = await db.diarySession.findMany({
            where: {
                psychologistId,
                date: { gte: start, lte: end },
                status: { notIn: ['cancelled', 'completed'] }
            },
            include: { client: { include: { telegramClient: true } } }
        });

        if (sessionsToCancel.length > 0) {
            await db.diarySession.updateMany({
                where: { id: { in: sessionsToCancel.map(s => s.id) } },
                data: { status: 'cancelled' }
            });

            // Trigger telegram messages
            for (const session of sessionsToCancel) {
                const clientChatId = session.client?.telegramClient?.telegramUserId || session.client?.telegramChatId;
                if (clientChatId) {
                    const message = `⚠️ Ваша запись на ${session.date.toLocaleDateString('ru-RU')} в ${session.time} была отменена психологом ` +
                        (data.reason ? `(Причина: ${data.reason}). ` : `. `) +
                        `Пожалуйста, свяжитесь для переноса.`;

                    try {
                        const { sendTelegramMessage } = await import('@/lib/telegram');
                        await sendTelegramMessage(clientChatId, message);
                    } catch (e) {
                        console.error('Failed to send cancellation notice to', clientChatId, e);
                    }
                }
            }
        }
    }

    revalidatePath('/diary/availability');
    revalidatePath('/diary');
    return { success: true };
}

export async function deleteTimeBlock(id: string) {
    await getPsychologistId();
    await db.diaryBlock.delete({ where: { id } });
    revalidatePath('/diary/availability');
}

export async function checkBlockIntersections(startDate: string, endDate: string) {
    const psychologistId = await getPsychologistId();
    const start = new Date(startDate);
    const end = new Date(endDate);

    // Find sessions in this date range
    const sessions = await db.diarySession.findMany({
        where: {
            psychologistId,
            date: {
                gte: start,
                lte: end
            },
            status: { notIn: ['cancelled', 'completed'] }
        },
        include: { client: true }
    });

    return sessions.map(s => ({
        id: s.id,
        date: s.date,
        time: s.time,
        clientName: s.client.name
    }));
}
