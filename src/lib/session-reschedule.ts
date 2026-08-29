import { db } from '@/lib/db';
import { autoSyncSessionToCalendars, autoDeleteSessionFromCalendars } from '@/lib/calendar/auto-sync';
import { notifyWaitlistOnFreedSlot } from '@/lib/waitlist-notify';

export class RescheduleConflictError extends Error {}

/**
 * Moves a session to a new date/time with a single UPDATE on the existing
 * row — the session is never deleted-then-recreated, so there is no window
 * where the client has zero or two active bookings for the slot.
 */
export async function rescheduleSessionAtomic(psychologistId: string, sessionId: string, newDate: Date, newTime: string) {
    const existing = await db.diarySession.findUnique({ where: { id: sessionId } });
    if (!existing || existing.psychologistId !== psychologistId) {
        throw new Error('Сессия не найдена');
    }
    if (existing.status === 'cancelled') {
        throw new Error('Эта сессия уже отменена');
    }

    const duration = existing.duration || 50;
    const [h, m] = newTime.split(':').map(Number);
    const endMinutes = h * 60 + m + duration;
    const endTime = `${String(Math.floor(endMinutes / 60) % 24).padStart(2, '0')}:${String(endMinutes % 60).padStart(2, '0')}`;

    const dayStart = new Date(newDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(newDate);
    dayEnd.setHours(23, 59, 59, 999);

    // Проверка пересечений (исключая текущую сессию)
    const daySessionsOnTarget = await db.diarySession.findMany({
        where: {
            psychologistId,
            id: { not: sessionId },
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
            throw new RescheduleConflictError('Это время уже занято другой сессией');
        }
    }

    // Delete old event from calendars before the update, create the new one after —
    // matches the calendar's own eventual-consistency contract used elsewhere.
    autoDeleteSessionFromCalendars(psychologistId, sessionId).catch(console.error);

    const session = await db.diarySession.update({
        where: { id: sessionId },
        data: {
            date: newDate,
            time: newTime,
            endTime,
            notified24h: false,
            notified1h: false,
        },
    });

    const fullSession = await db.diarySession.findUnique({
        where: { id: sessionId },
        include: { client: { select: { name: true } } },
    });
    if (fullSession) {
        autoSyncSessionToCalendars(psychologistId, fullSession).catch(console.error);
    }

    // O-260829 §5.2: старый час (existing.date/time, ДО обновления) освободился —
    // молча предлагаем его самой старой подходящей заявке листа ожидания.
    notifyWaitlistOnFreedSlot(psychologistId, existing.date, existing.time).catch(console.error);

    return session;
}
