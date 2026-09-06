import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateMobileRequest, unauthorizedResponse } from '@/lib/mobile-auth';
import { autoSyncSessionToCalendars, autoDeleteSessionFromCalendars } from '@/lib/calendar/auto-sync';
import { sendTelegramMessage } from '@/lib/telegram';
import { sendMaxMessage } from '@/lib/max-bot';
import { buildSessionClientMessage, clientBookingLink, getPaymentInstruction } from '@/lib/client-workflow';
import { formatSession, notesPlainFromStructured, toDatabasePaymentStatus } from '@/lib/mobile-sessions';
import { rescheduleManualPracticeSession, BookingConflictError } from '@/lib/practice/booking/booking';
import { observeNotesFilled, observePaymentSettled } from '@/lib/practice/attention-completion';

function buildPreviousNotesSummary(session: { structuredNotes?: unknown; clientSummary?: string | null; notes?: string | null } | null) {
    if (!session) return null;
    return notesPlainFromStructured(session.structuredNotes) || session.clientSummary || session.notes || null;
}

function notePatch(body: any) {
    const data: Record<string, unknown> = {};
    if (body.notes !== undefined) data.notes = body.notes;
    if (body.structuredNotes !== undefined) data.structuredNotes = body.structuredNotes;
    return data;
}

async function readPaymentStatus(sessionId: string) {
    const rows = await db.$queryRaw<Array<{ paymentStatus: string }>>`
        SELECT "paymentStatus" FROM "DiarySession" WHERE id = ${sessionId} LIMIT 1
    `.catch(() => []);
    return rows[0]?.paymentStatus || 'not_required';
}

/**
 * Задача 25 §8: одна точка отметки оплаты на оба ветвления PATCH. Событие
 * «проблема закрыта» рождается здесь и только здесь, из настоящего перехода
 * прежнего значения в новое — а не из факта, что кто-то открыл шторку оплаты.
 */
async function applyPaymentStatus(psychologistId: string, sessionId: string, value: string) {
    const before = await readPaymentStatus(sessionId);
    await writePaymentStatus(sessionId, value);
    await observePaymentSettled(psychologistId, before, value);
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
        `.catch(() => undefined);
    }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
            db.psychologistSettings.findUnique({ where: { psychologistId: auth.userId }, select: { onlineSessionLink: true } }),
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

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

            // Task 8: same shared advisory lock (session lock + both days'
            // day locks) and real maxSessionsPerDay re-check the web/client
            // reschedule paths get — the mobile app can still move a session
            // to any time on or off the psychologist's configured schedule,
            // same as before, just no longer via an unlocked read-then-write.
            let result;
            try {
                result = await rescheduleManualPracticeSession({
                    psychologistId: auth.userId,
                    sessionId: id,
                    dateStr: newDate,
                    time: newTime,
                    status: body.status ? body.status.toLowerCase() : 'pending',
                    extraUpdateData: notePatch(body),
                });
            } catch (e) {
                if (e instanceof BookingConflictError) {
                    return NextResponse.json({ error: e.message }, { status: 409 });
                }
                throw e;
            }
            const updated = result.session;

            // Task 12: autoSyncSessionToCalendars is link-aware — updates
            // the already-linked event in place, so no delete-then-recreate.
            if (paymentStatus) await applyPaymentStatus(auth.userId, id, paymentStatus);
            // Перенос может нести с собой заметку: extraUpdateData — это тот
            // же notePatch. Состояние «после» складывается из прежней сессии и
            // применённой правки; отдельного чтения ради этого не делаем.
            await observeNotesFilled(auth.userId, session, { ...session, ...notePatch(body) });

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
        if (paymentStatus) await applyPaymentStatus(auth.userId, id, paymentStatus);
        await observeNotesFilled(auth.userId, session, updated);
        return NextResponse.json(formatSession({ ...updated, paymentStatus: paymentStatus || await readPaymentStatus(id) }));
    } catch (error) {
        console.error('[mobile/sessions/id PATCH]', error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
