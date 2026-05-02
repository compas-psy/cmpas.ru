import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sendTelegramMessage } from '@/lib/telegram';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { sessionId, clientName } = body;

        if (!sessionId) {
            return NextResponse.json({ error: 'Session ID is required' }, { status: 400 });
        }

        const session = await db.diarySession.update({
            where: { id: sessionId },
            data: { status: 'cancelled' },
            include: { psychologist: true }
        });

        // Notify psychologist
        if (session.psychologist?.telegramChatId) {
            try {
                const dateStr = format(new Date(session.date), 'd MMMM', { locale: ru });
                await sendTelegramMessage(
                    session.psychologist.telegramChatId,
                    `⚠️ <b>Отмена сессии</b>\n\nКлиент ${clientName || 'по ссылке'} отменил запись:\n📅 Дата: ${dateStr}\n⏰ Время: ${session.time}\n\nСлот снова доступен для записи.`,
                    { parse_mode: 'HTML' }
                );
            } catch (e) {
                console.error("Failed to notify psychologist about cancellation", e);
            }
        }

        return NextResponse.json({ success: true });
    } catch (e: any) {
        console.error("Error cancelling session:", e);
        return NextResponse.json({ error: e.message || 'Internal Server Error' }, { status: 500 });
    }
}
