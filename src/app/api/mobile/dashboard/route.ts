import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateMobileRequest, unauthorizedResponse } from '@/lib/mobile-auth';
import { clientBookingLink } from '@/lib/client-workflow';

/**
 * GET /api/mobile/dashboard
 * Returns today's sessions, next session, week stats, attention items, and booking link.
 */
export async function GET(req: NextRequest) {
    const auth = await authenticateMobileRequest(req);
    if (!auth) return unauthorizedResponse();

    try {
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
        const weekAgo = new Date(today); weekAgo.setDate(weekAgo.getDate() - 7);

        const [todaySessions, weekSessions, user] = await Promise.all([
            db.diarySession.findMany({
                where: {
                    psychologistId: auth.userId,
                    date: { gte: today, lt: tomorrow },
                    status: { not: 'cancelled' },
                },
                include: { client: { select: { id: true, name: true } } },
                orderBy: { time: 'asc' },
            }),
            db.diarySession.findMany({
                where: { psychologistId: auth.userId, date: { gte: weekAgo, lt: tomorrow } },
                select: { status: true, clientId: true },
            }),
            db.user.findUnique({
                where: { id: auth.userId },
                select: { name: true, psychologistSettings: { select: { fullName: true } } },
            }),
        ]);

        const now = new Date();
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

        const nextSession = todaySessions.find(s => {
            const d = new Date(s.date);
            const [h, m] = (s.time || '00:00').split(':').map(Number);
            d.setHours(h, m);
            return d > now;
        });

        // Attention items
        const attentionItems: Array<{ type: string; count: number; label: string }> = [];

        const [sessionsWithoutNotes, clientsWithoutConsent] = await Promise.all([
            db.diarySession.count({
                where: {
                    psychologistId: auth.userId,
                    status: 'completed',
                    notes: null,
                    date: { lte: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000) },
                },
            }),
            db.diaryClient.count({
                where: { psychologistId: auth.userId, consentDate: null, status: 'active' },
            }),
        ]);

        if (sessionsWithoutNotes > 0) {
            attentionItems.push({ type: 'sessions_without_notes', count: sessionsWithoutNotes, label: 'Сессии без заметок' });
        }
        if (clientsWithoutConsent > 0) {
            attentionItems.push({ type: 'clients_without_consent', count: clientsWithoutConsent, label: 'Клиенты без согласия' });
        }

        const bookingLink = clientBookingLink(auth.userId, '');
        const baseBookingLink = bookingLink.replace(/\/c\/[^?]+/, '');

        const clientIds = new Set(weekSessions.map(s => s.clientId).filter(Boolean));

        return NextResponse.json({
            todaySessions: formattedSessions,
            nextSession: nextSession ? formattedSessions.find(s => s.id === nextSession.id) : null,
            weekStats: {
                sessionsCount: weekSessions.filter(s => s.status !== 'cancelled').length,
                newClients: clientIds.size,
                cancelledCount: weekSessions.filter(s => s.status === 'cancelled').length,
            },
            userName: user?.psychologistSettings?.fullName || user?.name || null,
            attentionItems,
            bookingLink: baseBookingLink,
        });
    } catch (error) {
        console.error('[mobile/dashboard]', error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
