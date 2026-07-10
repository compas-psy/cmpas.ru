'use server';

import { db } from '@/lib/db';
import { auth } from '@/auth';
import { revalidatePath } from 'next/cache';
import { autoSyncSessionToCalendars, autoDeleteSessionFromCalendars } from '@/lib/calendar/auto-sync';
import { sendTelegramMessage } from '@/lib/telegram';
import { sendMaxMessage } from '@/lib/max-bot';
import { buildSessionClientMessage, clientBookingLink, createAutoDocumentDeliveries, getPaymentInstruction, readSessionPaymentStatus, toDatabasePaymentStatus, writeSessionPaymentStatus } from '@/lib/client-workflow';

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
        include: { client: { select: { id: true, name: true, questionnaire: { select: { data: true } }, consentDate: true } } },
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
        include: { client: { select: { id: true, name: true, questionnaire: { select: { data: true } }, consentDate: true } } },
        orderBy: { time: 'asc' },
    });
}

async function createClientNoticeForSession(psychologistId: string, sessionId: string, isFirstSession: boolean) {
    const full = await db.diarySession.findFirst({
        where: { id: sessionId, psychologistId },
        include: {
            client: true,
            psychologist: { include: { psychologistSettings: true } },
        },
    });

    if (!full) return { status: 'not_found' as const };

    const channel = full.client.telegramChatId ? 'telegram' : (full.client as any).maxChatId ? 'max' : 'manual';
    const recipientContact = full.client.telegramChatId || (full.client as any).maxChatId || full.client.phone || full.client.email || null;
    const deliveries = isFirstSession ? await createAutoDocumentDeliveries({
        psychologistId,
        clientId: full.clientId,
        sessionId: full.id,
        trigger: 'first_session',
        channel,
        recipientContact,
    }) : [];

    const psyName = full.psychologist.psychologistSettings?.fullName || full.psychologist.name || 'специалист';
    const bookingLink = clientBookingLink(psychologistId, full.clientId);
    const onlineLink = full.format === 'online' ? full.psychologist.psychologistSettings?.onlineSessionLink : null;
    const paymentText = await getPaymentInstruction(psychologistId, full.id, full.clientId);
    const text = buildSessionClientMessage({
        clientName: full.client.name,
        psychologistName: psyName,
        date: full.date,
        time: full.time,
        format: full.format,
        onlineLink,
        documentLinks: deliveries.map(d => ({ title: d.title, link: d.link })),
        paymentText,
        bookingLink,
    });

    let sentTo: string | null = null;
    try {
        if (full.client.telegramChatId) {
            await sendTelegramMessage(full.client.telegramChatId, text, { parse_mode: 'HTML' });
            sentTo = 'telegram';
        } else if ((full.client as any).maxChatId) {
            await sendMaxMessage((full.client as any).maxChatId, text);
            sentTo = 'max';
        }
    } catch (error) {
        console.error('client notice send failed:', error);
    }

    return {
        status: sentTo ? 'sent' as const : 'manual' as const,
        channel: sentTo,
        text,
        bookingLink,
        documentLinks: deliveries.map(d => ({ title: d.title, link: d.link, deliveryId: d.deliveryId })),
    };
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
    const endTime = `${String(Math.floor(endMinutes / 60) % 24).padStart(2, '0')}:${String(endMinutes % 60).padStart(2, '0')}`;

    const sessionDate = new Date(data.date);
    const dayStart = new Date(sessionDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(sessionDate);
    dayEnd.setHours(23, 59, 59, 999);

    // Check for time conflicts
    const existingSessions = await db.diarySession.findMany({
        where: {
            psychologistId,
            date: { gte: dayStart, lte: dayEnd },
            status: { not: 'cancelled' },
        },
    });

    const newStartMins = h * 60 + m;
    const newEndMins = newStartMins + duration;

    for (const sess of existingSessions) {
        const [sH, sM] = sess.time.split(':').map(Number);
        const sStartMins = sH * 60 + sM;
        const sEndMins = sStartMins + (sess.duration || 50);
        if (newStartMins < sEndMins && newEndMins > sStartMins) {
            throw new Error('Это время уже занято другой сессией');
        }
    }

    const session = await db.diarySession.create({
        data: {
            psychologistId,
            clientId: data.clientId,
            date: sessionDate,
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

    // Auto-sync to calendars
    const fullSession = await db.diarySession.findUnique({
        where: { id: session.id },
        include: { client: { select: { name: true } } },
    });
    if (fullSession) {
        autoSyncSessionToCalendars(psychologistId, fullSession).catch(console.error);
    }

    let notice: any = null;
    try {
        notice = await createClientNoticeForSession(psychologistId, session.id, sessionsCount === 1);
    } catch (error) {
        console.error('create client notice failed:', error);
    }

    return { ...session, notice } as any;
}

export async function updateSession(id: string, data: {
    status?: string;
    notes?: string;
    structuredNotes?: any;
    privateNotes?: any;
    clientSummary?: string;
    paymentStatus?: string;
}) {
    const psychologistId = await getPsychologistId();

    // Build update payload — only include defined fields
    const updatePayload: Record<string, any> = { psychologistId };
    if (data.status !== undefined) updatePayload.status = data.status;
    if (data.notes !== undefined) updatePayload.notes = data.notes;
    if (data.structuredNotes !== undefined) updatePayload.structuredNotes = data.structuredNotes;
    if (data.privateNotes !== undefined) updatePayload.privateNotes = data.privateNotes;
    if (data.clientSummary !== undefined) updatePayload.clientSummary = data.clientSummary;

    const session = await db.diarySession.update({
        where: { id },
        data: updatePayload,
    });

    if (data.paymentStatus !== undefined) {
        const normalized = toDatabasePaymentStatus(data.paymentStatus);
        if (normalized) await writeSessionPaymentStatus(id, normalized);
    }

    // If cancelled, delete from calendars
    if (data.status === 'cancelled') {
        autoDeleteSessionFromCalendars(psychologistId, id).catch(console.error);
    }

    revalidatePath('/diary');
    return session;
}

export async function setSessionPaymentStatus(id: string, paymentStatus: 'not_required' | 'unpaid' | 'paid') {
    await getPsychologistId();
    const normalized = toDatabasePaymentStatus(paymentStatus);
    if (!normalized) throw new Error('Invalid paymentStatus');
    await writeSessionPaymentStatus(id, normalized);
    revalidatePath('/diary');
    return { success: true };
}

export async function getSessionPaymentStatus(id: string) {
    await getPsychologistId();
    return readSessionPaymentStatus(id);
}

/** PAY-1: past completed sessions still marked unpaid — for the "Требует внимания" widget. */
export async function getUnpaidPastSessionIds(): Promise<string[]> {
    const psychologistId = await getPsychologistId();
    const rows = await db.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM "DiarySession"
        WHERE "psychologistId" = ${psychologistId} AND status = 'completed' AND "paymentStatus" = 'unpaid'
        ORDER BY date DESC
        LIMIT 50
    `;
    return rows.map(r => r.id);
}

export async function deleteSession(id: string) {
    const psychologistId = await getPsychologistId();
    // Delete from calendars before deleting session
    autoDeleteSessionFromCalendars(psychologistId, id).catch(console.error);
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
    const endTime = `${String(Math.floor(endMinutes / 60) % 24).padStart(2, '0')}:${String(endMinutes % 60).padStart(2, '0')}`;

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

    // Delete old event from calendars
    autoDeleteSessionFromCalendars(psychologistId, id).catch(console.error);

    const session = await db.diarySession.update({
        where: { id },
        data: {
            date: dateObj,
            time: newTime,
            endTime,
            notified24h: false,
            notified1h: false,
        },
    });

    // Create new event in calendars with updated data
    const fullSession = await db.diarySession.findUnique({
        where: { id },
        include: { client: { select: { name: true } } },
    });
    if (fullSession) {
        autoSyncSessionToCalendars(psychologistId, fullSession).catch(console.error);
    }

    revalidatePath('/diary');
    return session;
}

export async function getAvailableDatesForReschedule(year: number, month: number) {
    const psychologistId = await getPsychologistId();
    const { getAvailableDates } = await import('@/app/bot/actions');
    return getAvailableDates(psychologistId, year, month, true, null, true); // skipBuffer=true for psychologist
}

export async function getAvailableTimesForReschedule(dateStr: string, sessionId?: string, clientId?: string) {
    const psychologistId = await getPsychologistId();
    const { getAvailableTimes } = await import('@/app/bot/actions');
    return getAvailableTimes(psychologistId, dateStr, true, sessionId, null, true); // skipBuffer=true for psychologist
}

export async function getClientActivity() {
    const psychologistId = await getPsychologistId();
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const events: Array<{
        clientId: string;
        clientName: string;
        type: 'homework_done' | 'session_confirmed' | 'consent_given';
        description: string;
        at: Date;
    }> = [];

    // Completed homeworks
    const doneHW = await db.homework.findMany({
        where: { psychologistId, status: 'completed', updatedAt: { gte: since } },
        include: { client: { select: { id: true, name: true } } },
        orderBy: { updatedAt: 'desc' },
        take: 5,
    });
    for (const hw of doneHW) {
        const sessionNum = await db.diarySession.count({ where: { clientId: hw.client.id, status: 'completed' } });
        events.push({
            clientId: hw.client.id,
            clientName: hw.client.name,
            type: 'homework_done',
            description: `Выполнил(а) ДЗ к ${sessionNum}-й сессии`,
            at: hw.updatedAt,
        });
    }

    // Recently confirmed sessions (status changed to confirmed)
    const recentConfirmed = await db.diarySession.findMany({
        where: { psychologistId, status: 'confirmed', updatedAt: { gte: since } },
        include: { client: { select: { id: true, name: true } } },
        orderBy: { updatedAt: 'desc' },
        take: 5,
    });
    for (const s of recentConfirmed) {
        const sessionDate = new Date(s.date);
        const dateStr = sessionDate.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
        events.push({
            clientId: s.client.id,
            clientName: s.client.name,
            type: 'session_confirmed',
            description: `Запись подтверждена на ${dateStr}`,
            at: s.updatedAt,
        });
    }

    // Clients who gave consent recently
    const newConsents = await db.diaryClient.findMany({
        where: { psychologistId, consentDate: { gte: since }, NOT: { consentDate: null } },
        orderBy: { consentDate: 'desc' },
        take: 3,
    });
    for (const c of newConsents) {
        if (c.consentDate) {
            events.push({
                clientId: c.id,
                clientName: c.name,
                type: 'consent_given',
                description: 'Подписал(а) согласие на обработку данных',
                at: c.consentDate,
            });
        }
    }

    events.sort((a, b) => b.at.getTime() - a.at.getTime());
    return events.slice(0, 5).map(e => ({ ...e, at: e.at.toISOString() }));
}

export async function getPreviousWeekStats() {
    const psychologistId = await getPsychologistId();
    const now = new Date();

    const startOfThisWeek = new Date(now);
    startOfThisWeek.setDate(now.getDate() - (now.getDay() + 6) % 7);
    startOfThisWeek.setHours(0, 0, 0, 0);

    const startOfPrevWeek = new Date(startOfThisWeek);
    startOfPrevWeek.setDate(startOfThisWeek.getDate() - 7);
    const endOfPrevWeek = new Date(startOfThisWeek);
    endOfPrevWeek.setMilliseconds(-1);

    const prevSessions = await db.diarySession.findMany({
        where: { psychologistId, date: { gte: startOfPrevWeek, lte: endOfPrevWeek }, status: { not: 'cancelled' } },
        select: { clientId: true },
    });

    return {
        sessions: prevSessions.length,
        clients: new Set(prevSessions.map(s => s.clientId)).size,
    };
}
