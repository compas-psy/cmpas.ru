import { NextRequest, NextResponse } from 'next/server';
import { authenticateMobileRequest, unauthorizedResponse } from '@/lib/mobile-auth';
import { resendSessionReminder, readSessionReminderStatus, type ClientReminderKind } from '@/lib/cron/reminders';

/**
 * Напоминания по сессии: фактический исход и повторная отправка.
 *
 * До этого маршрута приложение не могло ни узнать правду, ни повторить
 * отправку: статус «Отправлено» вычислялся из часов (момент прошёл — значит
 * ушло), а кнопка «Отправить ещё раз» открывала окно ручного сообщения.
 * Сервер знает фактический исход — он в ReminderOutbox.
 *
 * GET  → [{ kind, channel, status, sentAt, sendCount }]  — пусто, если по
 *        этой сессии рассылка ещё не отрабатывала.
 * POST { kind: 'session_24h_client' | 'session_1h_client' } → отправляет
 *        тем же путём, что и рассылка по расписанию, и пишет в тот же журнал.
 */

const KINDS: ClientReminderKind[] = ['session_24h_client', 'session_1h_client'];

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const auth = await authenticateMobileRequest(req);
    if (!auth) return unauthorizedResponse();
    const { id: sessionId } = await params;

    try {
        const reminders = await readSessionReminderStatus({ sessionId, psychologistId: auth.userId });
        return NextResponse.json({ reminders });
    } catch (error) {
        console.error('[mobile/sessions/reminders] GET:', error);
        return NextResponse.json({ error: 'internal error' }, { status: 500 });
    }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const auth = await authenticateMobileRequest(req);
    if (!auth) return unauthorizedResponse();
    const { id: sessionId } = await params;

    let kind: unknown;
    try {
        kind = (await req.json())?.kind;
    } catch {
        return NextResponse.json({ error: 'body must be json' }, { status: 400 });
    }
    if (typeof kind !== 'string' || !KINDS.includes(kind as ClientReminderKind)) {
        return NextResponse.json({ error: `kind must be one of ${KINDS.join(', ')}` }, { status: 400 });
    }

    try {
        const result = await resendSessionReminder({
            sessionId,
            psychologistId: auth.userId,
            kind: kind as ClientReminderKind,
        });

        if (result.ok) return NextResponse.json({ sent: true, channels: result.channels });

        // Отказ называется отказом: приложение обязано увидеть разницу между
        // «ушло», «клиент не в мессенджере» и «мессенджер не принял».
        const status = result.reason === 'not_found' ? 404 : 409;
        const message =
            result.reason === 'not_found' ? 'Сессия не найдена'
                : result.reason === 'no_channel' ? 'Клиент не подключён ни к Telegram, ни к MAX'
                    : 'Мессенджер не принял сообщение';
        return NextResponse.json({ sent: false, reason: result.reason, message }, { status });
    } catch (error) {
        console.error('[mobile/sessions/reminders] POST:', error);
        return NextResponse.json({ error: 'internal error' }, { status: 500 });
    }
}
