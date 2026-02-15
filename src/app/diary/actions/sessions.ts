'use server';

import { db } from '@/lib/db';
import { auth } from '@/auth';
import { revalidatePath } from 'next/cache';

async function getPsychologistId() {
    const session = await auth();
    if (!session?.user?.id) throw new Error('Unauthorized');
    return session.user.id;
}

export async function getSessions(dateFrom?: Date, dateTo?: Date) {
    const psychologistId = await getPsychologistId();
    return db.diarySession.findMany({
        where: {
            psychologistId,
            ...(dateFrom && dateTo ? { date: { gte: dateFrom, lte: dateTo } } : {}),
        },
        include: { client: { select: { id: true, name: true } } },
        orderBy: { date: 'asc' },
    });
}

export async function getSessionsByDate(date: Date) {
    const psychologistId = await getPsychologistId();
    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(date);
    dayEnd.setHours(23, 59, 59, 999);

    return db.diarySession.findMany({
        where: {
            psychologistId,
            date: { gte: dayStart, lte: dayEnd },
        },
        include: { client: { select: { id: true, name: true } } },
        orderBy: { time: 'asc' },
    });
}

export async function createSession(data: {
    clientId: string;
    date: string;
    time: string;
    duration?: number;
    type?: string;
    format?: string;
}) {
    const psychologistId = await getPsychologistId();
    const duration = data.duration || 50;
    const [h, m] = data.time.split(':').map(Number);
    const endMinutes = h * 60 + m + duration;
    const endTime = `${String(Math.floor(endMinutes / 60)).padStart(2, '0')}:${String(endMinutes % 60).padStart(2, '0')}`;

    const session = await db.diarySession.create({
        data: {
            psychologistId,
            clientId: data.clientId,
            date: new Date(data.date),
            time: data.time,
            endTime,
            duration,
            type: data.type || 'individual',
            format: data.format || 'online',
            status: 'confirmed',
        },
    });

    // Update client stats
    const sessionsCount = await db.diarySession.count({ where: { clientId: data.clientId } });
    const nextSession = await db.diarySession.findFirst({
        where: { clientId: data.clientId, date: { gte: new Date() }, status: { in: ['confirmed', 'pending'] } },
        orderBy: { date: 'asc' },
    });
    await db.diaryClient.update({
        where: { id: data.clientId },
        data: { totalSessions: sessionsCount, nextSessionDate: nextSession?.date || null },
    });

    revalidatePath('/diary');
    return session;
}

export async function updateSession(id: string, data: { status?: string; notes?: string }) {
    const psychologistId = await getPsychologistId();
    const session = await db.diarySession.update({
        where: { id },
        data: { ...data, psychologistId },
    });
    revalidatePath('/diary');
    return session;
}

export async function deleteSession(id: string) {
    await getPsychologistId();
    await db.diarySession.delete({ where: { id } });
    revalidatePath('/diary');
}
