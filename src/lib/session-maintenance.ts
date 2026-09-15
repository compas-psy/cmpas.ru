import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { createNotification } from '@/lib/notifications';

const POST_SESSION_SETTLE_GRACE_MINUTES = 15;

function minutesOf(value: string) {
    const [hours, minutes] = value.split(':').map(Number);
    return hours * 60 + minutes;
}

function endTimeFor(session: { time?: string | null; endTime?: string | null; duration?: number | null }) {
    if (session.endTime && /^\d{2}:\d{2}$/.test(session.endTime)) return session.endTime;
    const start = session.time && /^\d{2}:\d{2}$/.test(session.time) ? session.time : '00:00';
    const end = minutesOf(start) + (session.duration || 50);
    return `${String(Math.floor(end / 60) % 24).padStart(2, '0')}:${String(end % 60).padStart(2, '0')}`;
}

function sessionEndAt(session: { date: Date; time?: string | null; endTime?: string | null; duration?: number | null }) {
    const result = new Date(session.date);
    const [hours, minutes] = endTimeFor(session).split(':').map(Number);
    result.setHours(hours, minutes, 0, 0);
    return result;
}

function sessionIsReadyToSettle(session: { date: Date; time?: string | null; endTime?: string | null; duration?: number | null }, now: Date) {
    const cutoff = new Date(now.getTime() - POST_SESSION_SETTLE_GRACE_MINUTES * 60 * 1000);
    return sessionEndAt(session) < cutoff;
}

/**
 * НАПОМИНАТЬ ЛИ ПРО ЗАКРЫТУЮ ВСТРЕЧУ.
 *
 * Появилось вместе с расписанием для закрытия встреч (Ф12). Раньше закрытие
 * случалось только по открытию приложения, и у специалиста, работающего в
 * браузере, копились месяцы незакрытых встреч. В первый же проход по
 * расписанию все они закрылись бы разом — и вместе с ними пришло бы столько
 * же напоминаний «самое время для заметки» про встречи трёхмесячной
 * давности. Заметку к ним никто уже не напишет, а список уведомлений стал бы
 * нечитаемым в тот день, когда мы это выложили.
 *
 * Поэтому у напоминания есть окно: встречу закрываем всегда, а напоминаем
 * только про недавние. `windowDays === null` — напоминать про любые: так
 * зовёт приложение, и его поведение этой правкой не меняется.
 */
export function shouldNudgeForSettledSession(sessionEnd: Date, now: Date, windowDays: number | null): boolean {
    if (windowDays === null) return true;
    return now.getTime() - sessionEnd.getTime() <= windowDays * 24 * 60 * 60 * 1000;
}

function isBlankStructuredNotes(value: unknown) {
    if (!Array.isArray(value) || value.length === 0) return true;
    return value.every((block: any) => {
        if (!block?.values || typeof block.values !== 'object') return true;
        return Object.values(block.values).every((item) => !String(item || '').trim());
    });
}

async function notificationExists(params: { psychologistId: string; sessionId: string; type: string }) {
    const count = await db.practiceNotification.count({
        where: { psychologistId: params.psychologistId, sessionId: params.sessionId, type: params.type },
    }).catch(() => 0);
    return count > 0;
}

async function maybeNotifySessionNeedsNote(session: any) {
    const hasPlainNotes = Boolean(String(session.notes || session.clientSummary || '').trim());
    const hasStructuredNotes = !isBlankStructuredNotes(session.structuredNotes);
    if (hasPlainNotes || hasStructuredNotes) return false;

    const exists = await notificationExists({ psychologistId: session.psychologistId, sessionId: session.id, type: 'session_needs_note' });
    if (exists) return false;

    await createNotification({
        psychologistId: session.psychologistId,
        type: 'session_needs_note',
        title: `Сессия с ${session.client?.name || 'клиентом'} завершена`,
        subtitle: 'Самое время для заметки — если будет удобно',
        sessionId: session.id,
        clientId: session.clientId,
    }).catch(() => undefined);
    return true;
}

async function maybeNotifyUnpaidSession(session: any) {
    const rows = await db.$queryRaw<Array<{ paymentStatus: string | null }>>(Prisma.sql`
        SELECT "paymentStatus" FROM "DiarySession" WHERE id = ${session.id} LIMIT 1
    `).catch(() => []);
    if ((rows[0]?.paymentStatus || '').toLowerCase() !== 'unpaid') return false;

    const exists = await notificationExists({ psychologistId: session.psychologistId, sessionId: session.id, type: 'session_unpaid' });
    if (exists) return false;

    await createNotification({
        psychologistId: session.psychologistId,
        type: 'session_unpaid',
        title: 'Отметьте оплату сессии',
        subtitle: `${session.client?.name || 'Клиент'} · ${session.date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}, ${session.time}`,
        sessionId: session.id,
        clientId: session.clientId,
    }).catch(() => undefined);
    return true;
}

export async function settlePastSessionsForPsychologist(
    psychologistId: string,
    now = new Date(),
    options: { nudgeWindowDays?: number | null } = {},
) {
    const nudgeWindowDays = options.nudgeWindowDays ?? null;
    const dayEnd = new Date(now);
    dayEnd.setHours(23, 59, 59, 999);

    const candidates = await db.diarySession.findMany({
        where: { psychologistId, status: 'confirmed', date: { lte: dayEnd } },
        include: { client: { select: { id: true, name: true } } },
        take: 200,
    });

    const ended = candidates.filter((session) => sessionIsReadyToSettle(session, now));
    let completed = 0;
    let noteNudges = 0;
    let unpaidNudges = 0;

    for (const session of ended) {
        await db.diarySession.update({ where: { id: session.id }, data: { status: 'completed', postSessionNudged: true } });
        completed += 1;
        if (!shouldNudgeForSettledSession(sessionEndAt(session), now, nudgeWindowDays)) continue;
        if (await maybeNotifySessionNeedsNote(session)) noteNudges += 1;
        if (await maybeNotifyUnpaidSession(session)) unpaidNudges += 1;
    }

    const completedWithoutNudge = await db.diarySession.findMany({
        where: { psychologistId, status: 'completed', postSessionNudged: false, date: { lte: dayEnd } },
        include: { client: { select: { id: true, name: true } } },
        take: 200,
    });

    for (const session of completedWithoutNudge.filter((item) => sessionIsReadyToSettle(item, now))) {
        await db.diarySession.update({ where: { id: session.id }, data: { postSessionNudged: true } });
        if (!shouldNudgeForSettledSession(sessionEndAt(session), now, nudgeWindowDays)) continue;
        if (await maybeNotifySessionNeedsNote(session)) noteNudges += 1;
        if (await maybeNotifyUnpaidSession(session)) unpaidNudges += 1;
    }

    return { completed, noteNudges, unpaidNudges };
}

export async function settlePastSessionsForAllPsychologists(
    now = new Date(),
    options: { nudgeWindowDays?: number | null } = {},
) {
    const users = await db.diarySession.findMany({
        where: { status: { in: ['confirmed', 'completed'] }, date: { lte: now } },
        select: { psychologistId: true },
        distinct: ['psychologistId'],
        take: 500,
    });

    let completed = 0;
    let noteNudges = 0;
    let unpaidNudges = 0;
    for (const user of users) {
        const result = await settlePastSessionsForPsychologist(user.psychologistId, now, options);
        completed += result.completed;
        noteNudges += result.noteNudges;
        unpaidNudges += result.unpaidNudges;
    }
    return { psychologists: users.length, completed, noteNudges, unpaidNudges };
}

export function hasSessionNotes(session: { notes?: string | null; clientSummary?: string | null; structuredNotes?: unknown }) {
    return Boolean(String(session.notes || session.clientSummary || '').trim()) || !isBlankStructuredNotes(session.structuredNotes);
}

export function compareSessionStart(a: { date: Date; time?: string | null }, b: { date: Date; time?: string | null }) {
    const left = new Date(a.date); const [lh, lm] = (a.time || '00:00').split(':').map(Number); left.setHours(lh, lm, 0, 0);
    const right = new Date(b.date); const [rh, rm] = (b.time || '00:00').split(':').map(Number); right.setHours(rh, rm, 0, 0);
    return left.getTime() - right.getTime();
}

export function isSessionFuture(session: { date: Date; time?: string | null }, now = new Date()) {
    const start = new Date(session.date);
    const [hours, minutes] = (session.time || '00:00').split(':').map(Number);
    start.setHours(hours, minutes, 0, 0);
    return start > now;
}
