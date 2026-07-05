import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { autoDeleteSessionFromCalendars } from '@/lib/calendar/auto-sync';
import { clientBookingLink, verifyClientActionToken } from '@/lib/client-workflow';
import { createNotification } from '@/lib/notifications';

function resultPage(title: string, text: string, tone: 'success' | 'danger' = 'success') {
    const accent = tone === 'success' ? '#1A4D3A' : '#D4183D';
    return new NextResponse(`<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><style>body{margin:0;background:#faf8f5;color:#16271d;font-family:system-ui,-apple-system,sans-serif;display:grid;min-height:100vh;place-items:center;padding:24px}.card{max-width:520px;background:rgba(255,255,255,.9);border:1px solid rgba(255,255,255,.8);border-radius:28px;padding:28px;box-shadow:0 22px 60px rgba(18,56,41,.12)}h1{font-size:28px;margin:0 0 10px;color:${accent}}p{font-size:17px;line-height:1.5;margin:0;color:#5b6b61}</style></head><body><main class="card"><h1>${title}</h1><p>${text}</p></main></body></html>`, {
        status: 200,
        headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
    });
}

export async function GET(req: NextRequest) {
    const sessionId = req.nextUrl.searchParams.get('s');
    const action = req.nextUrl.searchParams.get('a');
    const token = req.nextUrl.searchParams.get('t');

    if (!sessionId || !action || !token) {
        return resultPage('Ссылка недействительна', 'Попросите специалиста отправить новое уведомление.', 'danger');
    }

    const session = await db.diarySession.findUnique({
        where: { id: sessionId },
        include: { client: true },
    });
    if (!session || !verifyClientActionToken(session.psychologistId, session.clientId, token)) {
        return resultPage('Ссылка недействительна', 'Сессия не найдена или ссылка устарела.', 'danger');
    }

    if (action === 'confirm') {
        if (session.status !== 'cancelled') {
            await db.diarySession.update({
                where: { id: session.id },
                data: { status: 'confirmed' },
            });
        }
        const date = session.date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
        await createNotification({
            psychologistId: session.psychologistId,
            type: 'session_confirmed',
            title: `${session.client.name} подтвердил(а) сессию`,
            subtitle: `${date} в ${session.time}`,
            sessionId: session.id,
            clientId: session.clientId,
        });
        return resultPage('Встреча подтверждена', `${date} в ${session.time}. Информация уже появилась у специалиста.`);
    }

    if (action === 'cancel') {
        await db.diarySession.update({
            where: { id: session.id },
            data: { status: 'cancelled' },
        });
        autoDeleteSessionFromCalendars(session.psychologistId, session.id).catch(console.error);
        const date = session.date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
        await createNotification({
            psychologistId: session.psychologistId,
            type: 'session_cancelled',
            title: `${session.client.name} отменил(а) сессию`,
            subtitle: `${date} в ${session.time}`,
            sessionId: session.id,
            clientId: session.clientId,
        });
        return resultPage('Встреча отменена', 'Специалист увидит изменение в КОМПАС.', 'danger');
    }

    if (action === 'reschedule') {
        const bookingUrl = clientBookingLink(session.psychologistId, session.clientId);
        return NextResponse.redirect(new URL(bookingUrl, req.url));
    }

    return resultPage('Неизвестное действие', 'Вернитесь в сообщение и выберите одну из доступных кнопок.', 'danger');
}
