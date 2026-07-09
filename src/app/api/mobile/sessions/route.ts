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
        await settlePastSessionsForPsychologist(auth.userId);

        const [sessionsRaw, settings] = await Promise.all([
            db.diarySession.findMany({
                where: {
                    psychologistId: auth.userId,
                    ...(from && to && {
                        date: { gte: new Date(from), lte: new Date(to + 'T23:59:59.999Z') },
                    }),
                    ...(status && { status: status.toLowerCase() }),
                },
                include: { client: { select: { id: true, name: true } } },
                orderBy: [{ date: 'asc' }, { time: 'asc' }],
                take: 200,
            }),
            db.psychologistSettings.findUnique({
                where: { psychologistId: auth.userId },
                select: { onlineSessionLink: true },
            }),
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
        const { clientId, date, startTime, endTime, format, type, duration: durationReq } = await req.json();
        if (!clientId || !date || !startTime) {
            return NextResponse.json({ error: 'clientId, date, startTime required' }, { status: 400 });
        }

        const duration = durationReq || 50;
        const [hours, minutes] = startTime.split(':').map(Number);
        const endMinutes = hours * 60 + minutes + duration;
        const computedEnd = endTime || `${String(Math.floor(endMinutes / 60) % 24).padStart(2, '0')}:${String(endMinutes % 60).padStart(2, '0')}`;

        const sessionDate = new Date(date);
        const dayStart = new Date(sessionDate); dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(sessionDate); dayEnd.setHours(23, 59, 59, 999);

        const existing = await db.diarySession.findMany({
            where: { psychologistId: auth.userId, date: { gte: dayStart, lte: dayEnd }, status: { not: 'cancelled' } },
        });
        const newStart = hours * 60 + minutes;
        const newEnd = newStart + duration;
        for (const item of existing) {
            const [itemHours, itemMinutes] = item.time.split(':').map(Number);
            const itemStart = itemHours * 60 + itemMinutes;
            const itemEnd = itemStart + (item.duration || 50);
            if (newStart < itemEnd && newEnd > itemStart) {
                return NextResponse.json({ error: 'Это время уже занято другой сессией' }, { status: 409 });
            }
        }

        const session = await db.diarySession.create({
            data: {
                psychologistId: auth.userId,
                clientId,
                date: sessionDate,
                time: startTime,
                endTime: computedEnd,
                duration,
                type: toDatabaseType(type),
                format: format === 'IN_PERSON' ? 'in_person' : 'online',
                status: 'pending',
            },
            include: { client: true },
        });

        await createNotification({
            psychologistId: auth.userId,
            type: 'session_pending',
            title: 'Новая сессия ожидает подтверждения',
            subtitle: `${session.client?.name || 'Клиент'} · ${session.date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}, ${session.time}`,
            sessionId: session.id,
            clientId,
        });

        const sessionsCount = await db.diarySession.count({ where: { clientId } });
        const nextSession = await db.diarySession.findFirst({
            where: { clientId, date: { gte: new Date() }, status: { in: ['confirmed', 'pending'] } },
            orderBy: { date: 'asc' },
        });
        await db.diaryClient.update({ where: { id: clientId }, data: { totalSessions: sessionsCount, nextSessionDate: nextSession?.date || null } });

        autoSyncSessionToCalendars(auth.userId, session as any).catch(console.error);

        let noticeStatus = 'none';
        let onlineSessionLink: string | null = null;
        try {
            const psychologist = await db.user.findUnique({ where: { id: auth.userId }, include: { psychologistSettings: true } });
            const client = session.client as any;
            const channel = client.maxChatId ? 'max' : client.telegramChatId ? 'telegram' : null;
            onlineSessionLink = psychologist?.psychologistSettings?.onlineSessionLink || null;

            const deliveries = sessionsCount === 1 ? await createAutoDocumentDeliveries({
                psychologistId: auth.userId,
                clientId,
                sessionId: session.id,
                trigger: 'first_session',
                channel: channel || 'manual',
                recipientContact: client.maxChatId || client.telegramChatId || null,
            }) : [];

            const psychologistName = psychologist?.psychologistSettings?.fullName || psychologist?.name || 'специалист';
            const bookingLink = clientBookingLink(auth.userId, clientId);
            const onlineLink = session.format === 'online' ? onlineSessionLink : null;
            const paymentText = await getPaymentInstruction(auth.userId, session.id, clientId);
            const text = buildSessionClientMessage({
                clientName: client.name,
                psychologistName,
                date: session.date,
                time: session.time,
                format: session.format,
                onlineLink,
                documentLinks: deliveries.map((delivery: any) => ({ title: delivery.title, link: delivery.link })),
                paymentText,
                bookingLink,
            });
            const message = `${text}\n\nПожалуйста, подтвердите встречу в сообщении-напоминании.`;
            if (channel === 'max') {
                await sendMaxMessage(client.maxChatId, message);
                noticeStatus = 'max_sent';
            } else if (channel === 'telegram') {
                await sendTelegramMessage(client.telegramChatId, message, { parse_mode: 'HTML' });
                noticeStatus = 'telegram_sent';
            }
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
