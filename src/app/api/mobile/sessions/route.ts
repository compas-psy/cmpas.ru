import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { authenticateMobileRequest, unauthorizedResponse } from '@/lib/mobile-auth';
import { autoSyncSessionToCalendars } from '@/lib/calendar/auto-sync';
import { sendTelegramMessage } from '@/lib/telegram';
import { sendMaxMessage } from '@/lib/max-bot';
import { buildSessionClientMessage, clientBookingLink, createAutoDocumentDeliveries, getPaymentInstruction } from '@/lib/client-workflow';
import { createNotification } from '@/lib/notifications';
import { settlePastSessionsForPsychologist } from '@/lib/session-maintenance';
import { formatSession, toDatabaseType } from '@/lib/mobile-sessions';
import { requireOwnedClient } from '@/lib/practice/ownership';
import { createManualPracticeSession, BookingConflictError } from '@/lib/practice/booking/booking';

async function withPaymentStatuses<T extends { id: string }>(sessions: T[]) {
    if (!sessions.length) return sessions;
    const rows = await db.$queryRaw<Array<{ id: string; paymentStatus: string }>>(Prisma.sql`
        SELECT id, "paymentStatus" FROM "DiarySession" WHERE id IN (${Prisma.join(sessions.map((session) => session.id))})
    `).catch(() => []);
    const byId = new Map(rows.map((row) => [row.id, row.paymentStatus]));
    return sessions.map((session) => ({ ...session, paymentStatus: byId.get(session.id) || 'not_required' }));
}

export async function GET(req: NextRequest) {
    const auth = await authenticateMobileRequest(req);
    if (!auth) return unauthorizedResponse();

    const from = req.nextUrl.searchParams.get('from');
    const to = req.nextUrl.searchParams.get('to');
    const status = req.nextUrl.searchParams.get('status');

    try {
        await settlePastSessionsForPsychologist(auth.userId).catch((error) => {
            console.error('[mobile/sessions GET] settle skipped:', error);
        });

        const [sessionsRaw, settings] = await Promise.all([
            db.diarySession.findMany({
                where: {
                    psychologistId: auth.userId,
                    ...(from && to && { date: { gte: new Date(from), lte: new Date(to + 'T23:59:59.999Z') } }),
                    ...(status && { status: status.toLowerCase() }),
                },
                include: { client: { select: { id: true, name: true } } },
                orderBy: [{ date: 'asc' }, { time: 'asc' }],
                take: 200,
            }),
            db.psychologistSettings.findUnique({ where: { psychologistId: auth.userId }, select: { onlineSessionLink: true } }),
        ]);
        const sessions = await withPaymentStatuses(sessionsRaw);
        return NextResponse.json(sessions.map(session => formatSession(session, settings?.onlineSessionLink || null)));
    } catch (error) {
        console.error('[mobile/sessions GET]', error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    const auth = await authenticateMobileRequest(req);
    if (!auth) return unauthorizedResponse();

    try {
        const { clientId, date, startTime, format, type, duration: durationReq, clientRequestId, notes } = await req.json();
        if (!clientId || !date || !startTime) return NextResponse.json({ error: 'clientId, date, startTime required' }, { status: 400 });

        try {
            await requireOwnedClient(auth.userId, clientId);
        } catch {
            return NextResponse.json({ error: 'Client not found' }, { status: 404 });
        }

        const duration = durationReq || 50;

        // Task 7: shared atomic core with web manual creation — a per-
        // (psychologist,day) advisory lock re-checks the clientRequestId
        // idempotency replay, the time collision, and a real
        // maxSessionsPerDay cap (previously unchecked here) all inside one
        // lock, so a lost-response retry can never race its own original
        // request into a duplicate the way a bare UNIQUE-constraint catch
        // could.
        let session;
        let alreadyExisted: boolean;
        try {
            ({ session, alreadyExisted } = await createManualPracticeSession({
                psychologistId: auth.userId,
                clientId,
                dateStr: date,
                time: startTime,
                duration,
                type: toDatabaseType(type),
                format: format === 'IN_PERSON' ? 'in_person' : 'online',
                status: 'pending',
                notes: typeof notes === 'string' && notes.trim() ? notes.trim() : null,
                clientRequestId: typeof clientRequestId === 'string' && clientRequestId ? clientRequestId : null,
            }));
        } catch (error) {
            if (error instanceof BookingConflictError) {
                return NextResponse.json({ error: error.message }, { status: 409 });
            }
            throw error;
        }

        // Idempotent replay of a lost response — the original request already
        // ran notifications/calendar-sync/client-notice; don't repeat them.
        if (alreadyExisted) {
            return NextResponse.json(formatSession(session as any));
        }

        await createNotification({
            psychologistId: auth.userId,
            type: 'session_pending',
            title: 'Новая сессия ожидает подтверждения',
            subtitle: `${session.client?.name || 'Клиент'} · ${session.date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}, ${session.time}`,
            sessionId: session.id,
            clientId,
        }).catch(() => undefined);

        const sessionsCount = await db.diarySession.count({ where: { clientId } });
        const nextSession = await db.diarySession.findFirst({ where: { clientId, date: { gte: new Date() }, status: { in: ['confirmed', 'pending'] } }, orderBy: { date: 'asc' } });
        await db.diaryClient.update({ where: { id: clientId }, data: { totalSessions: sessionsCount, nextSessionDate: nextSession?.date || null } });

        autoSyncSessionToCalendars(auth.userId, session as any).catch(console.error);

        let noticeStatus = 'none';
        let onlineSessionLink: string | null = null;
        try {
            const psychologist = await db.user.findUnique({ where: { id: auth.userId }, include: { psychologistSettings: true } });
            const client = session.client as any;
            const channel = client.maxChatId ? 'max' : client.telegramChatId ? 'telegram' : null;
            onlineSessionLink = psychologist?.psychologistSettings?.onlineSessionLink || null;
            const deliveries = sessionsCount === 1 ? await createAutoDocumentDeliveries({ psychologistId: auth.userId, clientId, sessionId: session.id, trigger: 'first_session', channel: channel || 'manual', recipientContact: client.maxChatId || client.telegramChatId || null }) : [];
            const psychologistName = psychologist?.psychologistSettings?.fullName || psychologist?.name || 'специалист';
            const bookingLink = clientBookingLink(auth.userId, clientId);
            const onlineLink = session.format === 'online' ? onlineSessionLink : null;
            const paymentText = await getPaymentInstruction(auth.userId, session.id, clientId);
            const text = buildSessionClientMessage({ clientName: client.name, psychologistName, date: session.date, time: session.time, format: session.format, onlineLink, documentLinks: deliveries.map((delivery: any) => ({ title: delivery.title, link: delivery.link })), paymentText, bookingLink });
            const message = `${text}\n\nПожалуйста, подтвердите встречу в сообщении-напоминании.`;
            if (channel === 'max') { await sendMaxMessage(client.maxChatId, message); noticeStatus = 'max_sent'; }
            else if (channel === 'telegram') { await sendTelegramMessage(client.telegramChatId, message, { parse_mode: 'HTML' }); noticeStatus = 'telegram_sent'; }
        } catch (notifyError) {
            console.error('[mobile/sessions POST] client notice failed:', notifyError);
            noticeStatus = 'failed';
        }

        return NextResponse.json({ ...formatSession(session, onlineSessionLink), noticeStatus }, { status: 201 });
    } catch (error) {
        console.error('[mobile/sessions POST]', error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
