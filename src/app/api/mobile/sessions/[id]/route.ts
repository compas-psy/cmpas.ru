import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateMobileRequest, unauthorizedResponse } from '@/lib/mobile-auth';
import { autoSyncSessionToCalendars, autoDeleteSessionFromCalendars } from '@/lib/calendar/auto-sync';
import { sendTelegramMessage } from '@/lib/telegram';
import { sendMaxMessage } from '@/lib/max-bot';
import { buildSessionClientMessage, clientBookingLink, getPaymentInstruction } from '@/lib/client-workflow';
import { formatSession } from '../route';

/**
 * GET /api/mobile/sessions/[id]
 */
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const auth = await authenticateMobileRequest(req);
    if (!auth) return unauthorizedResponse();
    const { id } = await params;

    try {
        const session = await db.diarySession.findFirst({
            where: { id, psychologistId: auth.userId },
            include: { client: { select: { id: true, name: true } } },
        });
        if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 });
        return NextResponse.json(formatSession(session));
    } catch (error) {
        console.error('[mobile/sessions/id GET]', error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}

/**
 * PATCH /api/mobile/sessions/[id]
 * Supports: status, notes, date, startTime (reschedule with conflict check + calendar sync).
 */
export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const auth = await authenticateMobileRequest(req);
    if (!auth) return unauthorizedResponse();
    const { id } = await params;

    try {
        const body = await req.json();

        const session = await db.diarySession.findFirst({
            where: { id, psychologistId: auth.userId },
        });
        if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 });

        const isReschedule = body.date || body.startTime;

        if (isReschedule) {
            const newDate = body.date || session.date.toISOString().split('T')[0];
            const newTime = body.startTime || session.time;
            const duration = session.duration || 50;
            const [h, m] = newTime.split(':').map(Number);
            const endMinutes = h * 60 + m + duration;
            const newEndTime = `${String(Math.floor(endMinutes / 60) % 24).padStart(2, '0')}:${String(endMinutes % 60).padStart(2, '0')}`;

            const dateObj = new Date(newDate);
            const dayStart = new Date(dateObj); dayStart.setHours(0, 0, 0, 0);
            const dayEnd = new Date(dateObj); dayEnd.setHours(23, 59, 59, 999);

            const conflicts = await db.diarySession.findMany({
                where: {
                    psychologistId: auth.userId,
                    id: { not: id },
                    date: { gte: dayStart, lte: dayEnd },
                    status: { not: 'cancelled' },
                },
            });
            const newStart = h * 60 + m;
            const newEnd = newStart + duration;
            for (const s of conflicts) {
                const [sH, sM] = s.time.split(':').map(Number);
                const sStart = sH * 60 + sM;
                const sEnd = sStart + (s.duration || 50);
                if (newStart < sEnd && newEnd > sStart) {
                    return NextResponse.json({ error: 'Это время уже занято другой сессией' }, { status: 409 });
                }
            }

            // Remove old calendar event, create new one
            autoDeleteSessionFromCalendars(auth.userId, id).catch(console.error);

            const updated = await db.diarySession.update({
                where: { id },
                data: {
                    date: dateObj,
                    time: newTime,
                    endTime: newEndTime,
                    notified24h: false,
                    notified1h: false,
                    ...(body.status && { status: body.status.toLowerCase() }),
                    ...(body.notes !== undefined && { notes: body.notes }),
                },
                include: { client: { select: { id: true, name: true } } },
            });

            const fullUpdated = await db.diarySession.findUnique({
                where: { id },
                include: { client: { select: { name: true } } },
            });
            if (fullUpdated) autoSyncSessionToCalendars(auth.userId, fullUpdated as any).catch(console.error);

            // Notify client about reschedule
            try {
                const client = await db.diaryClient.findUnique({ where: { id: updated.client?.id || '' } });
                if (client && (client.telegramChatId || (client as any).maxChatId)) {
                    const psych = await db.user.findUnique({
                        where: { id: auth.userId },
                        include: { psychologistSettings: true },
                    });
                    const psyName = psych?.psychologistSettings?.fullName || psych?.name || 'специалист';
                    const bookingLink = clientBookingLink(auth.userId, client.id);
                    const onlineLink = updated.format === 'online' ? psych?.psychologistSettings?.onlineSessionLink : null;
                    const paymentText = await getPaymentInstruction(auth.userId, id, client.id);
                    const text = buildSessionClientMessage({
                        clientName: client.name,
                        psychologistName: psyName,
                        date: updated.date,
                        time: updated.time,
                        format: updated.format,
                        onlineLink,
                        documentLinks: [],
                        paymentText,
                        bookingLink,
                    });
                    if (client.telegramChatId) {
                        await sendTelegramMessage(client.telegramChatId, `🔄 Встреча перенесена\n\n${text}`, { parse_mode: 'HTML' });
                    } else if ((client as any).maxChatId) {
                        await sendMaxMessage((client as any).maxChatId, `Встреча перенесена\n\n${text}`);
                    }
                }
            } catch (e) {
                console.error('[mobile/sessions/id PATCH] reschedule notice failed:', e);
            }

            return NextResponse.json(formatSession(updated));
        }

        // Simple update (status / notes only)
        const updateData: Record<string, unknown> = {};
        if (body.status) updateData.status = body.status.toLowerCase();
        if (body.notes !== undefined) updateData.notes = body.notes;

        // On cancel: remove from calendars
        if (body.status?.toLowerCase() === 'cancelled') {
            autoDeleteSessionFromCalendars(auth.userId, id).catch(console.error);
        }

        const updated = await db.diarySession.update({
            where: { id },
            data: updateData,
            include: { client: { select: { id: true, name: true } } },
        });
        return NextResponse.json(formatSession(updated));
    } catch (error) {
        console.error('[mobile/sessions/id PATCH]', error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}

/**
 * DELETE /api/mobile/sessions/[id]
 * Cancels the session with calendar cleanup and optional client notification.
 */
export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const auth = await authenticateMobileRequest(req);
    if (!auth) return unauthorizedResponse();
    const { id } = await params;

    try {
        const session = await db.diarySession.findFirst({
            where: { id, psychologistId: auth.userId },
            include: { client: true },
        });
        if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 });

        // Remove from calendars before deletion
        autoDeleteSessionFromCalendars(auth.userId, id).catch(console.error);

        await db.diarySession.delete({ where: { id } });

        // Notify client
        const client = session.client as any;
        if (client?.telegramChatId || client?.maxChatId) {
            try {
                const psych = await db.user.findUnique({
                    where: { id: auth.userId },
                    include: { psychologistSettings: true },
                });
                const psyName = psych?.psychologistSettings?.fullName || psych?.name || 'специалист';
                const dateStr = session.date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
                const msg = `❌ Сессия ${dateStr} в ${session.time} отменена специалистом (${psyName}). Для переноса — свяжитесь с ним напрямую.`;
                if (client.telegramChatId) {
                    await sendTelegramMessage(client.telegramChatId, msg);
                } else if (client.maxChatId) {
                    await sendMaxMessage(client.maxChatId, msg);
                }
            } catch (e) {
                console.error('[mobile/sessions/id DELETE] notify failed:', e);
            }
        }

        return NextResponse.json({ ok: true });
    } catch (error) {
        console.error('[mobile/sessions/id DELETE]', error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
