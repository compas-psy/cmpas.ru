import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateMobileRequest, unauthorizedResponse } from '@/lib/mobile-auth';

/**
 * GET /api/mobile/sessions
 * Returns sessions for the authenticated psychologist.
 * Query: ?from=2024-01-01&to=2024-01-31&status=pending
 */
export async function GET(req: NextRequest) {
    const auth = await authenticateMobileRequest(req);
    if (!auth) return unauthorizedResponse();

    const from = req.nextUrl.searchParams.get('from');
    const to = req.nextUrl.searchParams.get('to');
    const status = req.nextUrl.searchParams.get('status');

    try {
        const sessions = await db.diarySession.findMany({
            where: {
                psychologistId: auth.userId,
                ...(from && to && {
                    date: {
                        gte: new Date(from),
                        lte: new Date(to + 'T23:59:59.999Z'),
                    },
                }),
                ...(status && { status }),
            },
            include: {
                client: { select: { id: true, name: true } },
            },
            orderBy: [{ date: 'asc' }, { time: 'asc' }],
            take: 100,
        });

        const formatted = sessions.map(s => ({
            id: s.id,
            clientId: s.client?.id || '',
            clientName: s.client?.name || 'Без имени',
            date: s.date.toISOString().split('T')[0],
            startTime: s.time || '00:00',
            endTime: s.endTime || '',
            status: (s.status || 'PENDING').toUpperCase(),
            format: s.format === 'in_person' || s.format === 'offline' ? 'IN_PERSON' : 'ONLINE',
            videoLink: null,
            notes: typeof s.notes === 'string' ? s.notes : null,
        }));

        return NextResponse.json(formatted);
    } catch (error) {
        console.error('[mobile/sessions]', error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}

/**
 * POST /api/mobile/sessions
 * Create a new session.
 */
export async function POST(req: NextRequest) {
    const auth = await authenticateMobileRequest(req);
    if (!auth) return unauthorizedResponse();

    try {
        const { clientId, date, startTime, endTime, format } = await req.json();

        if (!clientId || !date || !startTime) {
            return NextResponse.json({ error: 'clientId, date, startTime required' }, { status: 400 });
        }

        const session = await db.diarySession.create({
            data: {
                psychologistId: auth.userId,
                clientId,
                date: new Date(date),
                time: startTime,
                endTime: endTime || null,
                format: format === 'IN_PERSON' ? 'in_person' : 'online',
                status: 'pending',
            },
            include: {
                client: { select: { id: true, name: true } },
            },
        });

        return NextResponse.json({
            id: session.id,
            clientId: session.client?.id || '',
            clientName: session.client?.name || '',
            date: session.date.toISOString().split('T')[0],
            startTime: session.time,
            endTime: session.endTime || '',
            status: 'PENDING',
            format: session.format === 'in_person' ? 'IN_PERSON' : 'ONLINE',
        });
    } catch (error) {
        console.error('[mobile/sessions]', error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
