import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateMobileRequest, unauthorizedResponse } from '@/lib/mobile-auth';

/**
 * GET /api/mobile/clients/[id]
 * Returns a single client by ID with sessions and messaging status.
 */
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const auth = await authenticateMobileRequest(req);
    if (!auth) return unauthorizedResponse();
    const { id } = await params;

    try {
        const client = await db.diaryClient.findFirst({
            where: { id, psychologistId: auth.userId },
            include: {
                _count: { select: { sessions: true } },
                sessions: {
                    orderBy: { date: 'desc' },
                    take: 5,
                    select: { id: true, date: true, time: true, status: true, notes: true },
                },
                questionnaire: { select: { data: true } },
            },
        });

        if (!client) return NextResponse.json({ error: 'Not found' }, { status: 404 });

        return NextResponse.json({
            id: client.id,
            name: client.name,
            email: client.email || null,
            phone: client.phone || null,
            telegramId: client.telegramChatId || null,
            maxId: (client as any).maxChatId || null,
            sessionsCount: client._count.sessions,
            lastSessionDate: client.sessions[0]?.date?.toISOString().split('T')[0] || null,
            status: (client.status || 'active').toUpperCase(),
            consentDate: client.consentDate?.toISOString() || null,
            recentSessions: client.sessions.map(s => ({
                id: s.id,
                date: s.date.toISOString().split('T')[0],
                time: s.time,
                status: (s.status || 'PENDING').toUpperCase(),
                notes: typeof s.notes === 'string' ? s.notes : null,
            })),
            hasMessenger: !!(client.telegramChatId || (client as any).maxChatId),
            messengerChannel: client.telegramChatId ? 'telegram' : (client as any).maxChatId ? 'max' : null,
        });
    } catch (error) {
        console.error('[mobile/clients/id GET]', error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}

/**
 * PATCH /api/mobile/clients/[id]
 * Update client fields (name, phone, email, status).
 */
export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const auth = await authenticateMobileRequest(req);
    if (!auth) return unauthorizedResponse();
    const { id } = await params;

    try {
        const client = await db.diaryClient.findFirst({
            where: { id, psychologistId: auth.userId },
        });
        if (!client) return NextResponse.json({ error: 'Not found' }, { status: 404 });

        const { name, phone, email, status } = await req.json();
        const updateData: Record<string, unknown> = {};
        if (name !== undefined) updateData.name = name;
        if (phone !== undefined) updateData.phone = phone;
        if (email !== undefined) updateData.email = email;
        if (status !== undefined) updateData.status = status.toLowerCase();

        const updated = await db.diaryClient.update({ where: { id }, data: updateData });
        return NextResponse.json({ id: updated.id, name: updated.name, status: (updated.status || 'active').toUpperCase() });
    } catch (error) {
        console.error('[mobile/clients/id PATCH]', error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
