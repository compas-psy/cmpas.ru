import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sendTelegramMessage } from '@/lib/telegram';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { canClientCancel, cancelRefusalText, verifyClientActionToken } from '@/lib/client-workflow';
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
            include: { psychologist: { include: { psychologistSettings: true } }, client: true },
        });

        if (!session || session.clientId !== clientId) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        if (!verifyClientActionToken(session.psychologistId, clientId, actionToken)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const decision = canClientCancel(session, session.psychologist.psychologistSettings);
        if (!decision.allowed) {
            await createNotification({
                psychologistId: session.psychologistId,
                type: 'client_cancel_attempt',
                title: `${clientName || session.client?.name || 'Клиент'} попытался(лась) отменить сессию поздно`,
                subtitle: `${format(new Date(session.date), 'd MMMM', { locale: ru })} в ${session.time} — менее ${decision.hoursSetting} ч до начала`,
                sessionId: session.id,
                clientId: session.clientId,
            });
            return NextResponse.json({ error: cancelRefusalText(decision.hoursSetting) }, { status: 409 });
        }

        const cancelled = await db.diarySession.update({
            where: { id: sessionId },
            data: { status: 'cancelled' },
            include: { psychologist: true, client: true },
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
