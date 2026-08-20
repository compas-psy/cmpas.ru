import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyClientActionToken } from '@/lib/client-workflow';
import { buildSessionIcs } from '@/lib/calendar/client-ics';

// CJM_booking_v1.md §1.3 "тихая запись": client-chosen calendar title,
// gated by the same PsychologistSettings.privateRemindersEnabled flag as
// the rest of "приватный режим" (O-260817-03) — off by default.
export async function GET(req: NextRequest) {
    const sessionId = req.nextUrl.searchParams.get('s');
    const token = req.nextUrl.searchParams.get('t');
    const title = req.nextUrl.searchParams.get('title');

    if (!sessionId || !token) {
        return new NextResponse('Ссылка недействительна', { status: 400 });
    }

    const session = await db.diarySession.findUnique({
        where: { id: sessionId },
        select: {
            id: true, psychologistId: true, clientId: true,
            date: true, time: true, endTime: true, duration: true, status: true,
        },
    });

    if (!session || session.status === 'cancelled') {
        return new NextResponse('Событие не найдено', { status: 404 });
    }

    if (!verifyClientActionToken(session.psychologistId, session.clientId, token)) {
        return new NextResponse('Ссылка недействительна', { status: 403 });
    }

    const settings = await db.psychologistSettings.findUnique({
        where: { psychologistId: session.psychologistId },
        select: { privateRemindersEnabled: true },
    });
    if (!settings?.privateRemindersEnabled) {
        return new NextResponse('Недоступно', { status: 404 });
    }

    const ics = buildSessionIcs(session, { title, uid: `session-${session.id}@cmpas.ru` });

    return new NextResponse(ics, {
        status: 200,
        headers: {
            'content-type': 'text/calendar; charset=utf-8',
            'content-disposition': 'attachment; filename="session.ics"',
            'cache-control': 'no-store',
        },
    });
}
