import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateMobileRequest, unauthorizedResponse } from '@/lib/mobile-auth';

function addMinutes(time: string, minutes: number) {
    const [hours, mins] = time.split(':').map(Number);
    const total = hours * 60 + mins + minutes;
    return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

function sessionType(raw: string | null) {
    if (raw === 'couple') return 'COUPLE';
    if (raw === 'family') return 'FAMILY';
    return 'INDIVIDUAL';
}

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
                    orderBy: [{ date: 'desc' }, { time: 'desc' }],
                    take: 20,
                    select: {
                        id: true,
                        date: true,
                        time: true,
                        endTime: true,
                        duration: true,
                        type: true,
                        format: true,
                        status: true,
                        notes: true,
                    },
                },
            },
        });

        if (!client) return NextResponse.json({ error: 'Not found' }, { status: 404 });

        const now = new Date();
        const lastSession = client.sessions.find(session => session.date < now && session.status !== 'cancelled');

        return NextResponse.json({
            id: client.id,
            name: client.name,
            email: client.email || null,
            phone: client.phone || null,
            gender: client.gender || null,
            telegramId: client.telegramChatId || null,
            maxId: client.maxChatId || null,
            sessionsCount: client._count.sessions,
            lastSessionDate: lastSession?.date?.toISOString().split('T')[0] || null,
            status: (client.status || 'active').toUpperCase(),
            consentDate: client.consentDate?.toISOString() || null,
            recentSessions: client.sessions.map(session => ({
                id: session.id,
                clientId: client.id,
                clientName: client.name,
                date: session.date.toISOString().split('T')[0],
                startTime: session.time || '00:00',
                endTime: session.endTime || addMinutes(session.time || '00:00', session.duration || 50),
                status: (session.status || 'PENDING').toUpperCase(),
                format: session.format === 'in_person' || session.format === 'offline' ? 'IN_PERSON' : 'ONLINE',
                type: sessionType(session.type),
                videoLink: null,
                notes: typeof session.notes === 'string' ? session.notes : null,
            })),
            hasMessenger: !!(client.telegramChatId || client.maxChatId),
            messengerChannel: client.telegramChatId ? 'telegram' : client.maxChatId ? 'max' : null,
        });
    } catch (error) {
        console.error('[mobile/clients/id GET]', error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}

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
