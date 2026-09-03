import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sendTelegramMessage } from '@/lib/telegram';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { verifySessionActionToken } from '@/lib/client-workflow';
import { canClientCancel, clientCancelBlockedMessage } from '@/lib/client-cancellation';
import { createNotification } from '@/lib/notifications';

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { sessionId, clientId, clientToken, token, clientName } = body;
        const actionToken = clientToken || token;

        if (!sessionId || !clientId || !actionToken) {
            return NextResponse.json({ error: 'Session ID, client ID and token are required' }, { status: 403 });
        }

        const session = await db.diarySession.findUnique({
            where: { id: sessionId },
            include: { psychologist: true, client: true },
        });

        if (!session || session.clientId !== clientId) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        // Task 3 (PRAKTIKA MVP, item D): bound to THIS session and the
        // 'cancel' action specifically — a token minted for a different
        // session, or for 'confirm'/'reschedule', is rejected here.
        if (!verifySessionActionToken(session.psychologistId, clientId, sessionId, 'cancel', actionToken)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const settings = await db.psychologistSettings.findUnique({
            where: { psychologistId: session.psychologistId },
            select: { cancellationHours: true },
        });
        const policy = canClientCancel(session, settings);
        if (!policy.allowed) {
            const message = clientCancelBlockedMessage(policy.limitHours);
            await createNotification({
                psychologistId: session.psychologistId,
                type: 'client_cancel_attempt',
                title: `${clientName || session.client?.name || 'Клиент'} пытался отменить запись`,
                subtitle: message,
                sessionId: session.id,
                clientId: session.clientId,
            });
            return NextResponse.json({ error: message, limitHours: policy.limitHours }, { status: 409 });
        }

        const cancelled = await db.diarySession.update({
            where: { id: sessionId },
            data: { status: 'cancelled' },
            include: { psychologist: true, client: true },
        });

        await createNotification({
            psychologistId: cancelled.psychologistId,
            type: 'session_cancelled',
            title: `${clientName || cancelled.client?.name || 'Клиент'} отменил запись`,
            subtitle: `${format(new Date(cancelled.date), 'd MMMM', { locale: ru })} в ${cancelled.time}`,
            sessionId: cancelled.id,
            clientId: cancelled.clientId,
        });

        if (cancelled.psychologist?.telegramChatId) {
            try {
                const dateStr = format(new Date(cancelled.date), 'd MMMM', { locale: ru });
                await sendTelegramMessage(
                    cancelled.psychologist.telegramChatId,
                    `⚠️ <b>Отмена сессии</b>\n\nКлиент ${clientName || cancelled.client?.name || 'по ссылке'} отменил запись:\n📅 Дата: ${dateStr}\n⏰ Время: ${cancelled.time}\n\nСлот снова доступен для записи.`,
                    { parse_mode: 'HTML' }
                );
            } catch (e) {
                console.error('Failed to notify psychologist about cancellation', e);
            }
        }

        return NextResponse.json({ success: true });
    } catch (e: any) {
        console.error('Error cancelling session:', e);
        return NextResponse.json({ error: e.message || 'Internal Server Error' }, { status: 500 });
    }
}
