import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { autoDeleteSessionFromCalendars } from '@/lib/calendar/auto-sync';
import { verifyClientActionToken } from '@/lib/client-workflow';
import { createNotification } from '@/lib/notifications';
import { canClientCancel, clientCancelBlockedMessage, isClientLinkExpired } from '@/lib/client-cancellation';
import { notifyWaitlistOnFreedSlot } from '@/lib/waitlist-notify';

function escapeHtml(value: string) {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function resultPage(title: string, text: string, tone: 'success' | 'danger' = 'success') {
    const accent = tone === 'success' ? '#1A4D3A' : '#D4183D';
    return new NextResponse(`<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title><style>body{margin:0;background:#faf8f5;color:#16271d;font-family:system-ui,-apple-system,sans-serif;display:grid;min-height:100vh;place-items:center;padding:24px}.card{max-width:520px;background:rgba(255,255,255,.9);border:1px solid rgba(255,255,255,.8);border-radius:28px;padding:28px;box-shadow:0 22px 60px rgba(18,56,41,.12)}h1{font-size:28px;margin:0 0 10px;color:${accent}}p{font-size:17px;line-height:1.5;margin:0;color:#5b6b61}</style></head><body><main class="card"><h1>${escapeHtml(title)}</h1><p>${escapeHtml(text)}</p></main></body></html>`, {
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

    const settings = await db.psychologistSettings.findUnique({
        where: { psychologistId: session.psychologistId },
        select: { cancellationHours: true, privateRemindersEnabled: true },
    });

    // CJM_booking_v1.md §1.3 "тихая запись": once opted in, the specialist's
    // clients stop being able to act on a link after the session is over —
    // an old notification shouldn't stay a live button forever.
    if (settings?.privateRemindersEnabled && isClientLinkExpired(session)) {
        return resultPage('Ссылка недействительна', 'Эта встреча уже прошла.', 'danger');
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
        const policy = canClientCancel(session, settings);
        if (!policy.allowed) {
            const message = clientCancelBlockedMessage(policy.limitHours);
            await createNotification({
                psychologistId: session.psychologistId,
                type: 'client_cancel_attempt',
                title: `${session.client.name} пытался(ась) отменить сессию`,
                subtitle: message,
                sessionId: session.id,
                clientId: session.clientId,
            });
            return resultPage('Отмена уже недоступна', message, 'danger');
        }

        await db.diarySession.update({
            where: { id: session.id },
            data: { status: 'cancelled' },
        });
        autoDeleteSessionFromCalendars(session.psychologistId, session.id).catch(console.error);
        // O-260829 §5.2: этот час освободился — молча предлагаем его самой
        // старой подходящей заявке листа ожидания.
        notifyWaitlistOnFreedSlot(session.psychologistId, session.date, session.time).catch(console.error);
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
        return NextResponse.redirect(new URL(`/client/reschedule/${session.id}?t=${token}`, req.url));
    }

    return resultPage('Неизвестное действие', 'Вернитесь в сообщение и выберите одну из доступных кнопок.', 'danger');
}
