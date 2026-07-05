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

export async function GET(req: NextRequest) {
    const clientId = await resolveClientId(req.nextUrl.searchParams);
    if (!clientId) return NextResponse.json([]);

    const sessions = await db.diarySession.findMany({
        where: {
            clientId,
            date: { gte: startOfToday() },
            status: { not: 'cancelled' },
        },
        include: {
            psychologist: {
                select: {
                    name: true,
                    psychologistSettings: { select: { fullName: true, onlineSessionLink: true } },
                },
            },
            address: { select: { name: true, address: true } },
        },
        orderBy: [{ date: 'asc' }, { time: 'asc' }],
    });

    return NextResponse.json(sessions.map((session) => ({
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
    })));
}
