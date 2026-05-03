import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateMobileRequest, unauthorizedResponse } from '@/lib/mobile-auth';

/**
 * GET /api/mobile/dashboard
 * Returns today's sessions, next session, and week stats.
 */
export async function GET(req: NextRequest) {
    const auth = await authenticateMobileRequest(req);
    if (!auth) return unauthorizedResponse();

    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const weekAgo = new Date(today);
        weekAgo.setDate(weekAgo.getDate() - 7);

        // Today's sessions (field is psychologistId, not userId)
        const todaySessions = await db.diarySession.findMany({
            where: {
                psychologistId: auth.userId,
                date: { gte: today, lt: tomorrow },
                status: { not: 'cancelled' },
            },
            include: {
                client: { select: { id: true, name: true } },
            },
            orderBy: { time: 'asc' },
        });

        // Week stats
        const weekSessions = await db.diarySession.findMany({
            where: {
                psychologistId: auth.userId,
                date: { gte: weekAgo, lt: tomorrow },
            },
            select: { status: true, clientId: true, date: true },
        });

        const now = new Date();
        const nextSession = todaySessions.find(s => {
            const sessionTime = new Date(s.date);
            const [h, m] = (s.time || '00:00').split(':').map(Number);
            sessionTime.setHours(h, m);
            return sessionTime > now;
        });

        // Format sessions for mobile
        const formattedSessions = todaySessions.map(s => ({
            id: s.id,
            clientId: s.client?.id || '',
            clientName: s.client?.name || 'Без имени',
            date: s.date.toISOString().split('T')[0],
            startTime: s.time || '00:00',
            endTime: s.endTime || '',
            status: (s.status || 'PENDING').toUpperCase(),
            format: s.format === 'in_person' || s.format === 'offline' ? 'IN_PERSON' : 'ONLINE',
            videoLink: null,
            notes: null,
        }));

        // Count unique new clients this week
        const clientIds = new Set(weekSessions.map(s => s.clientId).filter(Boolean));

        return NextResponse.json({
            todaySessions: formattedSessions,
            nextSession: nextSession ? formattedSessions.find(s => s.id === nextSession.id) : null,
            weekStats: {
                sessionsCount: weekSessions.filter(s => s.status !== 'cancelled').length,
                newClients: clientIds.size,
                cancelledCount: weekSessions.filter(s => s.status === 'cancelled').length,
            },
        });
    } catch (error) {
        console.error('[mobile/dashboard]', error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
