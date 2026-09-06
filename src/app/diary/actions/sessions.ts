'use server';

import { db } from '@/lib/db';
import { auth } from '@/auth';
import { revalidatePath } from 'next/cache';
import { autoSyncSessionToCalendars, autoDeleteSessionFromCalendars } from '@/lib/calendar/auto-sync';
import { sendTelegramMessage } from '@/lib/telegram';
import { sendMaxMessage } from '@/lib/max-bot';
import { buildSessionClientMessage, clientBookingLink, createAutoDocumentDeliveries, getPaymentInstruction } from '@/lib/client-workflow';
import { notifyWaitlistOnFreedSlot } from '@/lib/waitlist-notify';
import { track } from '@/lib/analytics/track';
import { requireOwnedSession, requireOwnedClient } from '@/lib/practice/ownership';
import { createManualPracticeSession, reschedulePracticeBooking, BookingConflictError } from '@/lib/practice/booking/booking';

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
    await requireOwnedClient(psychologistId, data.clientId);

    // Task 7: shared atomic core with mobile — a per-(psychologist,day)
    // advisory lock, so two concurrent manual creates for the same day can't
    // both pass a stale collision check, plus a real maxSessionsPerDay cap
    // (previously unchecked here entirely).
    let session;
    try {
        ({ session } = await createManualPracticeSession({
            psychologistId,
            clientId: data.clientId,
            dateStr: data.date,
            time: data.time,
            duration: data.duration,
            type: data.type,
            format: data.format,
        }));
    } catch (e) {
        if (e instanceof BookingConflictError) throw new Error(e.message);
        throw e;
    }

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
}) {
    const psychologistId = await getPsychologistId();
    await requireOwnedSession(psychologistId, id);

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

    // If cancelled, delete from calendars
    if (data.status === 'cancelled') {
        autoDeleteSessionFromCalendars(psychologistId, id).catch(console.error);
    }

    revalidatePath('/diary');
    return session;
}

export async function deleteSession(id: string) {
    const psychologistId = await getPsychologistId();
    await requireOwnedSession(psychologistId, id);
    // Delete from calendars before deleting session
    autoDeleteSessionFromCalendars(psychologistId, id).catch(console.error);
    await db.diarySession.deleteMany({ where: { id, psychologistId } });
    revalidatePath('/diary');
}

// Task 8: RescheduleModal only ever offers times from the SAME availability
// grid getAvailableTimesForReschedule already resolves — which, since Task
// 7, always mints a slotToken per candidate. reschedulePracticeBooking
// re-verifies that token and re-validates it under the shared advisory lock
// (same core as a fresh booking), then does an UPDATE in place — no
// separate, unlocked collision check exists anymore.
export async function rescheduleSession(id: string, slotToken: string) {
    const psychologistId = await getPsychologistId();

    let result;
    try {
        result = await reschedulePracticeBooking({
            psychologistId,
            sessionId: id,
            slotToken,
            origin: 'manual',
            skipBuffer: true, // psychologist-facing — same as getAvailableTimesForReschedule's skipBuffer=true
        });
    } catch (e) {
        if (e instanceof BookingConflictError) throw new Error(e.message);
        throw e;
    }

    const { session, previousDate, previousTime } = result;

    // Task 12: autoSyncSessionToCalendars is link-aware — updates the
    // already-linked event in place, so no delete-then-recreate here.
    const fullSession = await db.diarySession.findUnique({
        where: { id },
        include: { client: { select: { name: true } } },
    });
    if (fullSession) {
        autoSyncSessionToCalendars(psychologistId, fullSession).catch(console.error);
    }
    notifyWaitlistOnFreedSlot(psychologistId, previousDate, previousTime).catch(console.error);

    revalidatePath('/diary');
    return session;
}

// O-260829 §5.4 (правка по дополняющему Android-ТЗ, android_booking_v2.md
// §1): вечерняя отметка специалиста ("была"/"не пришёл") пишется ПРЯМО в
// status ('completed' | 'no_show'), а не в отдельное поле outcome — рабочий
// контракт status уже наполовину существовал (Android SessionStatus.NO_SHOW,
// серверный /api/mobile/sessions/[id] принимает любую строку статуса).
// Заводить отдельное поле было бы двоевластием: web писал бы в outcome,
// Android — в status, для одного и того же факта.
//
// Тот же приём владения, что и rescheduleSession выше: сессия сначала
// ищется по id одна, затем сверяется psychologistId, и только потом
// мутируется — а не совмещается в одном findMany/updateMany filter, чтобы
// чужая сессия давала внятную ошибку, а не молчаливый no-op.
export async function markSessionOutcome(id: string, outcome: 'completed' | 'no_show') {
    const psychologistId = await getPsychologistId();

    const existing = await db.diarySession.findUnique({ where: { id } });
    if (!existing || existing.psychologistId !== psychologistId) {
        throw new Error('Сессия не найдена');
    }
    // Отменённой сессии не было — "была"/"не пришёл" тут не имеет смысла и
    // перезаписывать status='cancelled' было бы неверно.
    if (existing.status === 'cancelled') {
        throw new Error('Эта сессия отменена');
    }

    // Отметку можно поставить заново (специалист передумал, либо поправляет
    // автоматическое status='completed' от settlePastSessionsForPsychologist
    // на 'no_show' задним числом) — ТЗ не запрещает менять исход, поэтому
    // update, а не guard на "уже отмечено".
    const now = new Date();
    const session = await db.diarySession.update({
        where: { id },
        data: { status: outcome },
    });

    // O-260829 §7: session_outcome_marked — факт вечерней отметки, без
    // содержимого (только исход и через сколько часов после конца сессии).
    const [h, m] = (existing.endTime || existing.time).split(':').map(Number);
    const sessionEnd = new Date(existing.date);
    sessionEnd.setHours(h, m, 0, 0);
    const hoursAfterEnd = Math.round((now.getTime() - sessionEnd.getTime()) / (60 * 60 * 1000));
    await track(db, {
        event: 'session_outcome_marked',
        product: 'practice',
        accountId: psychologistId,
        props: { outcome, hours_after_end: hoursAfterEnd },
    });

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
