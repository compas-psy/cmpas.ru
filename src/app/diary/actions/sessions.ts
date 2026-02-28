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
        include: { client: { select: { id: true, name: true, questionnaire: { select: { data: true } } } } },
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
        include: { client: { select: { id: true, name: true, questionnaire: { select: { data: true } } } } },
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

    const sessionDate = new Date(data.date);
    const dayStart = new Date(sessionDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(sessionDate);
    dayEnd.setHours(23, 59, 59, 999);

    // Валидация: нет ли уже записи на пересекающийся временной слот
    const existingSessions = await db.diarySession.findMany({
        where: {
            psychologistId,
            date: { gte: dayStart, lte: dayEnd },
            status: { not: 'cancelled' },
        },
    });

    const newStartMins = h * 60 + m;
    const newEndMins = newStartMins + duration;

    for (const existing of existingSessions) {
        const [eH, eM] = existing.time.split(':').map(Number);
        const eStartMins = eH * 60 + eM;
        const eEndMins = eStartMins + (existing.duration || 50);
        if (newStartMins < eEndMins && newEndMins > eStartMins) {
            throw new Error('Это время уже занято другой сессией');
        }
    }

    // Валидация: один клиент не может быть записан 2+ раз в один день
    const clientSessionsToday = existingSessions.filter(s => s.clientId === data.clientId);
    if (clientSessionsToday.length > 0) {
        throw new Error('Этот клиент уже записан на данный день');
    }

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

export async function rescheduleSession(id: string, newDate: string, newTime: string) {
    const psychologistId = await getPsychologistId();

    const existing = await db.diarySession.findUnique({ where: { id } });
    if (!existing || existing.psychologistId !== psychologistId) {
        throw new Error('Сессия не найдена');
    }

    const duration = existing.duration || 50;
    const [h, m] = newTime.split(':').map(Number);
    const endMinutes = h * 60 + m + duration;
    const endTime = `${String(Math.floor(endMinutes / 60)).padStart(2, '0')}:${String(endMinutes % 60).padStart(2, '0')}`;

    const dateObj = new Date(newDate);
    const dayStart = new Date(dateObj);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dateObj);
    dayEnd.setHours(23, 59, 59, 999);

    // Проверка пересечений (исключая текущую сессию)
    const daySessionsOnTarget = await db.diarySession.findMany({
        where: {
            psychologistId,
            id: { not: id },
            date: { gte: dayStart, lte: dayEnd },
            status: { not: 'cancelled' },
        },
    });

    const newStartMins = h * 60 + m;
    const newEndMins = newStartMins + duration;

    for (const sess of daySessionsOnTarget) {
        const [sH, sM] = sess.time.split(':').map(Number);
        const sStartMins = sH * 60 + sM;
        const sEndMins = sStartMins + (sess.duration || 50);
        if (newStartMins < sEndMins && newEndMins > sStartMins) {
            throw new Error('Это время уже занято другой сессией');
        }
    }

    const session = await db.diarySession.update({
        where: { id },
        data: {
            date: dateObj,
            time: newTime,
            endTime,
        },
    });

    revalidatePath('/diary');
    return session;
}
