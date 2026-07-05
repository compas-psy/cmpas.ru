import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateMobileRequest, unauthorizedResponse } from '@/lib/mobile-auth';
import { autoSyncSessionToCalendars, autoDeleteSessionFromCalendars } from '@/lib/calendar/auto-sync';
import { sendTelegramMessage } from '@/lib/telegram';
import { sendMaxMessage } from '@/lib/max-bot';
import { buildSessionClientMessage, clientBookingLink, getPaymentInstruction } from '@/lib/client-workflow';
import { formatSession, normalizeStructuredNotesForStorage, notesPlainFromStructured, toDatabasePaymentStatus } from '@/lib/mobile-session-format';

function buildPreviousNotesSummary(session: { structuredNotes?: unknown; clientSummary?: string | null; notes?: string | null } | null) {
    if (!session) return null;
    return notesPlainFromStructured(session.structuredNotes) || session.clientSummary || session.notes || null;
}

function notePatch(body: any) {
    const data: Record<string, unknown> = {};
    if (body.notes !== undefined) data.notes = body.notes;
    if (body.structuredNotes !== undefined) data.structuredNotes = normalizeStructuredNotesForStorage(body.structuredNotes);
    return data;
}

async function readPaymentStatus(sessionId: string) {
    const rows = await db.$queryRaw<Array<{ paymentStatus: string }>>`
        SELECT "paymentStatus" FROM "DiarySession" WHERE id = ${sessionId} LIMIT 1
    `;
    return rows[0]?.paymentStatus || 'not_required';
}

async function writePaymentStatus(sessionId: string, value: string) {
    await db.$executeRaw`
        UPDATE "DiarySession" SET "paymentStatus" = ${value}, "updatedAt" = NOW() WHERE id = ${sessionId}
    `;
    if (value === 'paid') {
        await db.$executeRaw`
            UPDATE "SessionPaymentRequest"
            SET status = 'paid', "markedPaidAt" = COALESCE("markedPaidAt", NOW()), "updatedAt" = NOW()
            WHERE "sessionId" = ${sessionId}
        `;
    }
}

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

        const [settings, previousSession, paymentStatus] = await Promise.all([
            db.psychologistSettings.findUnique({
                where: { psychologistId: auth.userId },
                select: { onlineSessionLink: true },
            }),
            db.diarySession.findFirst({
                where: {
                    psychologistId: auth.userId,
                    clientId: session.clientId,
                    id: { not: session.id },
                    date: { lt: session.date },
                    status: { in: ['completed', 'confirmed'] },
                },
                orderBy: [{ date: 'desc' }, { time: 'desc' }],
                select: { notes: true, clientSummary: true, structuredNotes: true },
            }),
            readPaymentStatus(session.id),
        ]);

        return NextResponse.json({
            ...formatSession({ ...session, paymentStatus }),
            videoLink: session.format === 'online' ? settings?.onlineSessionLink || null : null,
            previousNotesSummary: buildPreviousNotesSummary(previousSession),
        });
    } catch (error) {
        console.error('[mobile/sessions/id GET]', error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}

export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const auth = await authenticateMobileRequest(req);
    if (!auth) return unauthorizedResponse();
    const { id } = await params;

    try {
        const body = await req.json();
        const session = await db.diarySession.findFirst({ where: { id, psychologistId: auth.userId } });
        if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 });

        const paymentStatus = body.paymentStatus !== undefined ? toDatabasePaymentStatus(body.paymentStatus) : null;
        if (body.paymentStatus !== undefined && !paymentStatus) {
            return NextResponse.json({ error: 'paymentStatus must be paid, unpaid or not_required' }, { status: 400 });
        }

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
                where: { psychologistId: auth.userId, id: { not: id }, date: { gte: dayStart, lte: dayEnd }, status: { not: 'cancelled' } },
            });
            const newStart = h * 60 + m;
            const newEnd = newStart + duration;
            for (const conflict of conflicts) {
                const [sH, sM] = conflict.time.split(':').map(Number);
                const sStart = sH * 60 + sM;
                const sEnd = sStart + (conflict.duration || 50);
                if (newStart < sEnd && newEnd > sStart) {
                    return NextResponse.json({ error: 'Это время уже занято другой сессией' }, { status: 409 });
                }
            }
            autoDeleteSessionFromCalendars(auth.userId, id).catch(console.error);
            const updated = await db.diarySession.update({
                where: { id },
                data: {
                    date: dateObj,
                    time: newTime,
                    endTime: newEndTime,
                    status: body.status ? body.status.toLowerCase() : 'pending',
                    notified24h: false,
                    notified1h: false,
                    ...notePatch(body),
                },
                include: { client: { select: { id: true, name: true } } },
            });
            if (paymentStatus) await writePaymentStatus(id, paymentStatus);
            const fullUpdated = await db.diarySession.findUnique({ where: { id }, include: { client: { select: { name: true } } } });
            if (fullUpdated) autoSyncSessionToCalendars(auth.userId, fullUpdated as any).catch(console.error);
            try {
                const client = await db.diaryClient.findUnique({ where: { id: updated.client?.id || '' } });
                if (client && (client.telegramChatId || client.maxChatId)) {
                    const psych = await db.user.findUnique({ where: { id: auth.userId }, include: { psychologistSettings: true } });
                    const psychologistName = psych?.psychologistSettings?.fullName || psych?.name || 'специалист';
                    const bookingLink = clientBookingLink(auth.userId, client.id);
                    const onlineLink = updated.format === 'online' ? psych?.psychologistSettings?.onlineSessionLink : null;
                    const paymentText = await getPaymentInstruction(auth.userId, id, client.id);
                    const text = buildSessionClientMessage({ clientName: client.name, psychologistName, date: updated.date, time: updated.time, format: updated.format, onlineLink, documentLinks: [], paymentText, bookingLink });
                    const prefix = 'Встреча перенесена. Пожалуйста, подтвердите новое время.\n\n';
                    if (client.telegramChatId) await sendTelegramMessage(client.telegramChatId, `${prefix}${text}`, { parse_mode: 'HTML' });
                    else if (client.maxChatId) await sendMaxMessage(client.maxChatId, `${prefix}${text}`);
                }
            } catch (error) {
                console.error('[mobile/sessions/id PATCH] reschedule notice failed:', error);
            }
            return NextResponse.json(formatSession({ ...updated, paymentStatus: paymentStatus || await readPaymentStatus(id) }));
        }

        const updateData: Record<string, unknown> = {};
        if (body.status) updateData.status = body.status.toLowerCase();
        Object.assign(updateData, notePatch(body));
        if (body.status?.toLowerCase() === 'cancelled') autoDeleteSessionFromCalendars(auth.userId, id).catch(console.error);
        const updated = Object.keys(updateData).length > 0
            ? await db.diarySession.update({ where: { id }, data: updateData, include: { client: { select: { id: true, name: true } } } })
            : await db.diarySession.findFirstOrThrow({ where: { id, psychologistId: auth.userId }, include: { client: { select: { id: true, name: true } } } });
        if (paymentStatus) await writePaymentStatus(id, paymentStatus);
        return NextResponse.json(formatSession({ ...updated, paymentStatus: paymentStatus || await readPaymentStatus(id) }));
    } catch (error) {
        console.error('[mobile/sessions/id PATCH]', error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}

export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const auth = await authenticateMobileRequest(req);
    if (!auth) return unauthorizedResponse();
    const { id } = await params;

    try {
        const session = await db.diarySession.findFirst({ where: { id, psychologistId: auth.userId }, include: { client: true } });
        if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 });
        autoDeleteSessionFromCalendars(auth.userId, id).catch(console.error);
        await db.diarySession.delete({ where: { id } });
        const client = session.client as any;
        if (client?.telegramChatId || client?.maxChatId) {
            try {
                const psych = await db.user.findUnique({ where: { id: auth.userId }, include: { psychologistSettings: true } });
                const psychologistName = psych?.psychologistSettings?.fullName || psych?.name || 'специалист';
                const date = session.date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
                const message = `Сессия ${date} в ${session.time} отменена специалистом (${psychologistName}). Для переноса свяжитесь с ним напрямую.`;
                if (client.telegramChatId) await sendTelegramMessage(client.telegramChatId, message);
                else if (client.maxChatId) await sendMaxMessage(client.maxChatId, message);
            } catch (error) {
                console.error('[mobile/sessions/id DELETE] notify failed:', error);
            }
        }
        return NextResponse.json({ ok: true });
    } catch (error) {
        console.error('[mobile/sessions/id DELETE]', error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
