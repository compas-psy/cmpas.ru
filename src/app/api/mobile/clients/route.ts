import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateMobileRequest, unauthorizedResponse } from '@/lib/mobile-auth';

/**
 * GET /api/mobile/clients
 * Returns client list for the authenticated psychologist.
 * Query: ?search=...
 */
export async function GET(req: NextRequest) {
    const auth = await authenticateMobileRequest(req);
    if (!auth) return unauthorizedResponse();

    const search = req.nextUrl.searchParams.get('search') || '';

    try {
        const clients = await db.diaryClient.findMany({
            where: {
                psychologistId: auth.userId,
                ...(search && {
                    name: { contains: search, mode: 'insensitive' as const },
                }),
            },
            include: {
                _count: { select: { sessions: true } },
                sessions: {
                    orderBy: { date: 'desc' },
                    take: 1,
                    select: { date: true },
                },
            },
            orderBy: { name: 'asc' },
        });

        const now = new Date();
        // Get upcoming sessions for all clients in one query
        const upcomingSessions = await db.diarySession.findMany({
            where: {
                psychologistId: auth.userId,
                date: { gte: now },
                status: { not: 'cancelled' },
            },
            select: { clientId: true, date: true, time: true },
            orderBy: { date: 'asc' },
        });

        // Build a map: clientId -> next session
        const nextSessionMap = new Map<string, { date: string; time: string }>();
        for (const s of upcomingSessions) {
            if (s.clientId && !nextSessionMap.has(s.clientId)) {
                nextSessionMap.set(s.clientId, {
                    date: s.date.toISOString().split('T')[0],
                    time: s.time || '',
                });
            }
        }

        const formatted = clients.map(c => {
            const nextSess = nextSessionMap.get(c.id);
            return {
                id: c.id,
                name: c.name,
                email: c.email || null,
                phone: c.phone || null,
                telegramId: c.telegramChatId || null,
                sessionsCount: c._count.sessions,
                lastSessionDate: c.sessions[0]?.date?.toISOString().split('T')[0] || null,
                notes: null,
                status: (c.status || 'active').toUpperCase(),
                nextSessionDate: nextSess?.date || null,
                nextSessionTime: nextSess?.time || null,
            };
        });

        return NextResponse.json(formatted);
    } catch (error) {
        console.error('[mobile/clients]', error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}

/**
 * POST /api/mobile/clients
 * Create a new client.
 * Body: { name, email?, phone? }
 */
export async function POST(req: NextRequest) {
    const auth = await authenticateMobileRequest(req);
    if (!auth) return unauthorizedResponse();

    try {
        const { name, email, phone } = await req.json();

        if (!name || typeof name !== 'string') {
            return NextResponse.json({ error: 'Name required' }, { status: 400 });
        }

        const client = await db.diaryClient.create({
            data: {
                psychologistId: auth.userId,
                name,
                email: email || null,
                phone: phone || null,
            },
        });

        return NextResponse.json({
            id: client.id,
            name: client.name,
            email: client.email,
            phone: client.phone,
            sessionsCount: 0,
            lastSessionDate: null,
            status: 'ACTIVE',
        });
    } catch (error) {
        console.error('[mobile/clients]', error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
