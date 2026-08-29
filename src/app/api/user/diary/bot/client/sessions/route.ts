import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { clientActionToken } from '@/lib/client-workflow';

function startOfToday() {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return now;
}

async function resolveClientId(params: URLSearchParams) {
    const clientId = params.get('clientId');
    if (clientId) return clientId;

    const telegramChatId = params.get('telegramChatId');
    if (!telegramChatId) return null;

    const direct = await db.diaryClient.findFirst({
        where: { telegramChatId },
        select: { id: true },
    });
    if (direct) return direct.id;

    const linked = await db.telegramClient.findUnique({
        where: { telegramUserId: telegramChatId },
        select: { diaryClientId: true },
    });
    return linked?.diaryClientId ?? null;
}

const sessionInclude = {
    psychologist: {
        select: {
            name: true,
            psychologistSettings: { select: { fullName: true, onlineSessionLink: true } },
        },
    },
    address: { select: { name: true, address: true } },
} as const;

function mapSession(session: any) {
    return {
        id: session.id,
        clientId: session.clientId,
        clientToken: clientActionToken(session.psychologistId, session.clientId),
        date: session.date,
        time: session.time,
        endTime: session.endTime,
        status: session.status,
        format: session.format,
        psychologistId: session.psychologistId,
        psychologistName: session.psychologist.psychologistSettings?.fullName || session.psychologist.name || 'Специалист',
        onlineSessionLink: session.psychologist.psychologistSettings?.onlineSessionLink || null,
        address: session.address ? { name: session.address.name, fullAddress: session.address.address } : null,
    };
}

export async function GET(req: NextRequest) {
    const clientId = await resolveClientId(req.nextUrl.searchParams);
    if (!clientId) return NextResponse.json({ upcoming: [], past: [] });

    const todayStart = startOfToday();

    const [upcoming, past] = await Promise.all([
        db.diarySession.findMany({
            where: {
                clientId,
                date: { gte: todayStart },
                status: { not: 'cancelled' },
            },
            include: sessionInclude,
            orderBy: [{ date: 'asc' }, { time: 'asc' }],
        }),
        db.diarySession.findMany({
            where: {
                clientId,
                date: { lt: todayStart },
                status: { not: 'cancelled' },
            },
            include: sessionInclude,
            orderBy: [{ date: 'desc' }, { time: 'desc' }],
        }),
    ]);

    return NextResponse.json({
        upcoming: upcoming.map(mapSession),
        past: past.map(mapSession),
    });
}
