import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { clientActionToken, resolvePersonalClientToken } from '@/lib/client-workflow';
import { verifyTelegramWebAppInitData } from '@/lib/telegram-webapp';

function startOfToday() {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return now;
}

// Task 3 (PRAKTIKA MVP addendum §6, REGRESSION GATE): identity for this route
// must come ONLY from something the server itself verifies — never from a
// raw clientId/telegramChatId the caller supplies. Two legitimate sources:
//   1) Telegram Mini App — the X-Telegram-Init-Data header, HMAC-verified
//      against TELEGRAM_BOT_TOKEN. initDataUnsafe.user is client-controlled
//      and must never be trusted directly.
//   2) Personal link token (`?c=`) — verified server-side by
//      resolvePersonalClientToken, the same function the booking page's
//      server action already uses. A clientId resolved client-side and
//      replayed as a bare id (the previous bug) grants nothing here: this
//      route re-derives identity from the token itself, every time.
// A forged/wrong/missing credential resolves to `null`, which returns an
// empty (not another client's) session list below.
async function resolveClientId(req: NextRequest): Promise<string | null> {
    const initData = req.headers.get('x-telegram-init-data');
    if (initData) {
        const user = verifyTelegramWebAppInitData(initData, process.env.TELEGRAM_BOT_TOKEN);
        if (!user) return null;
        const telegramChatId = String(user.id);

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

    const token = req.nextUrl.searchParams.get('c');
    const resolved = resolvePersonalClientToken(token);
    return resolved?.clientId ?? null;
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
    const clientId = await resolveClientId(req);
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
