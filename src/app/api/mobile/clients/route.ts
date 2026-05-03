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
                userId: auth.userId,
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

        const formatted = clients.map(c => ({
            id: c.id,
            name: c.name,
            email: c.email || null,
            phone: c.phone || null,
            telegramId: c.telegramId || null,
            sessionsCount: c._count.sessions,
            lastSessionDate: c.sessions[0]?.date?.toISOString().split('T')[0] || null,
            notes: null,
            status: 'ACTIVE',
        }));

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
                userId: auth.userId,
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
