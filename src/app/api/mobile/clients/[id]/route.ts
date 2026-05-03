import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateMobileRequest, unauthorizedResponse } from '@/lib/mobile-auth';

/**
 * GET /api/mobile/clients/[id]
 * Returns a single client by ID.
 */
export async function GET(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    const auth = await authenticateMobileRequest(req);
    if (!auth) return unauthorizedResponse();

    try {
        const client = await db.diaryClient.findFirst({
            where: {
                id: params.id,
                psychologistId: auth.userId,
            },
            include: {
                _count: { select: { sessions: true } },
                sessions: {
                    orderBy: { date: 'desc' },
                    take: 1,
                    select: { date: true },
                },
            },
        });

        if (!client) {
            return NextResponse.json({ error: 'Not found' }, { status: 404 });
        }

        return NextResponse.json({
            id: client.id,
            name: client.name,
            email: client.email || null,
            phone: client.phone || null,
            telegramId: client.telegramChatId || null,
            sessionsCount: client._count.sessions,
            lastSessionDate: client.sessions[0]?.date?.toISOString().split('T')[0] || null,
            status: (client.status || 'active').toUpperCase(),
        });
    } catch (error) {
        console.error('[mobile/clients/id]', error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
