'use server';

import { db } from '@/lib/db';
import { verifySessionActionToken } from '@/lib/client-workflow';
import { getAvailableDates, getAvailableTimes } from '@/app/bot/actions';
import { rescheduleSessionAtomic, RescheduleConflictError } from '@/lib/session-reschedule';
import { createNotification } from '@/lib/notifications';

async function loadAuthorizedSession(sessionId: string, token: string) {
    const session = await db.diarySession.findUnique({
        where: { id: sessionId },
        include: { client: true, psychologist: { select: { name: true } } },
    });
    // Task 3 (item D): bound to THIS session and the 'reschedule' action —
    // a confirm/cancel token, or a reschedule token minted for a different
    // session, is rejected here.
    if (!session || !verifySessionActionToken(session.psychologistId, session.clientId, sessionId, 'reschedule', token)) {
        throw new Error('Ссылка недействительна. Попросите специалиста отправить новое уведомление.');
    }
    return session;
}

export async function getClientRescheduleSession(sessionId: string, token: string) {
    const session = await loadAuthorizedSession(sessionId, token);
    return {
        date: session.date.toISOString().split('T')[0],
        time: session.time,
        status: session.status,
        clientName: session.client.name,
        psychologistName: session.psychologist.name || 'специалист',
    };
}

export async function getAvailableDatesForClientReschedule(sessionId: string, token: string, year: number, month: number) {
    const session = await loadAuthorizedSession(sessionId, token);
    return getAvailableDates(session.psychologistId, year, month, false, session.clientId);
}

export async function getAvailableTimesForClientReschedule(sessionId: string, token: string, dateStr: string) {
    const session = await loadAuthorizedSession(sessionId, token);
    return getAvailableTimes(session.psychologistId, dateStr, false, sessionId, session.clientId);
}

export async function submitClientReschedule(sessionId: string, token: string, dateStr: string, time: string) {
    const session = await loadAuthorizedSession(sessionId, token);
    if (session.status === 'cancelled') {
        throw new Error('Эта сессия уже отменена, перенести её нельзя');
    }

    let updated;
    try {
        updated = await rescheduleSessionAtomic(session.psychologistId, sessionId, new Date(dateStr), time);
    } catch (e) {
        if (e instanceof RescheduleConflictError) throw new Error(e.message);
        throw e;
    }

    const dateLabel = updated.date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
    await createNotification({
        psychologistId: session.psychologistId,
        type: 'session_rescheduled',
        title: `${session.client.name} перенёс(ла) сессию`,
        subtitle: `Новое время: ${dateLabel} в ${updated.time}`,
        sessionId: updated.id,
        clientId: session.clientId,
    });

    return { date: dateLabel, time: updated.time };
}
