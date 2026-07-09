import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { authenticateMobileRequest, unauthorizedResponse } from '@/lib/mobile-auth';
import { clientBookingLink } from '@/lib/client-workflow';
import { listNotifications } from '@/lib/notifications';
import { compareSessionStart, hasSessionNotes, isSessionFuture, settlePastSessionsForPsychologist } from '@/lib/session-maintenance';

function normalizePaymentStatus(value: unknown) {
    const raw = String(value || 'not_required').toLowerCase();
    if (raw === 'paid') return 'PAID';
    if (raw === 'unpaid') return 'UNPAID';
    return 'NOT_REQUIRED';
}

async function paymentStatusMap(sessionIds: string[]) {
    if (!sessionIds.length) return new Map<string, string>();
    const rows = await db.$queryRaw<Array<{ id: string; paymentStatus: string }>>(Prisma.sql`
        SELECT id, "paymentStatus" FROM "DiarySession" WHERE id IN (${Prisma.join(sessionIds)})
    `).catch(() => []);
    return new Map(rows.map((row) => [row.id, row.paymentStatus]));
}

function formatSession(s: any, paymentById: Map<string, string>, onlineLink: string | null) {
    return {
        id: s.id,
        clientId: s.client?.id || s.clientId || '',
        clientName: s.client?.name || 'Без имени',
        date: s.date.toISOString().split('T')[0],
        startTime: s.time || '00:00',
        endTime: s.endTime || '',
        status: (s.status || 'PENDING').toUpperCase(),
        paymentStatus: normalizePaymentStatus(paymentById.get(s.id)),
        format: s.format === 'in_person' || s.format === 'offline' ? 'IN_PERSON' : 'ONLINE',
        type: s.type === 'couple' ? 'COUPLE' : s.type === 'family' ? 'FAMILY' : 'INDIVIDUAL',
        videoLink: s.format === 'in_person' || s.format === 'offline' ? null : onlineLink,
        notes: typeof s.notes === 'string' ? s.notes : null,
        notesPlain: typeof s.clientSummary === 'string' ? s.clientSummary : typeof s.notes === 'string' ? s.notes : null,
        structuredNotes: Array.isArray(s.structuredNotes) ? s.structuredNotes : null,
    };
}

export async function GET(req: NextRequest) {
    const auth = await authenticateMobileRequest(req);
    if (!auth) return unauthorizedResponse();

    try {
        await settlePastSessionsForPsychologist(auth.userId);

        const now = new Date();
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
        const weekAgo = new Date(today); weekAgo.setDate(weekAgo.getDate() - 7);
        const horizon = new Date(today); horizon.setDate(horizon.getDate() + 30);

        const [todaySessions, weekSessions, user, futureCandidates, completedCandidates, unpaidPastSessions, notificationPage] = await Promise.all([
            db.diarySession.findMany({
                where: { psychologistId: auth.userId, date: { gte: today, lt: tomorrow }, status: { not: 'cancelled' } },
                include: { client: { select: { id: true, name: true } } },
                orderBy: { time: 'asc' },
            }),
            db.diarySession.findMany({ where: { psychologistId: auth.userId, date: { gte: weekAgo, lt: tomorrow } }, select: { id: true, status: true, clientId: true } }),
            db.user.findUnique({
                where: { id: auth.userId },
                select: { name: true, psychologistSettings: { select: { fullName: true, onlineSessionLink: true } } },
            }),
            db.diarySession.findMany({
                where: {
                    psychologistId: auth.userId,
                    date: { gte: today, lte: horizon },
                    status: { in: ['pending', 'confirmed'] },
                },
                include: { client: { select: { id: true, name: true } } },
                orderBy: [{ date: 'asc' }, { time: 'asc' }],
                take: 60,
            }),
            db.diarySession.findMany({
                where: { psychologistId: auth.userId, status: 'completed', date: { lte: tomorrow } },
                select: { id: true, notes: true, clientSummary: true, structuredNotes: true },
                take: 500,
            }),
            db.$queryRaw<Array<{ count: bigint }>>`
                SELECT COUNT(*)::bigint as count
                FROM "DiarySession"
                WHERE "psychologistId" = ${auth.userId}
                  AND status = 'completed'
                  AND "paymentStatus" = 'unpaid'
            `.catch(() => []),
            listNotifications(auth.userId, { limit: 30 }),
        ]);

        const nextSessionRaw = futureCandidates
            .filter((session) => isSessionFuture(session, now))
            .sort(compareSessionStart)[0] || null;

        const paymentById = await paymentStatusMap([
            ...todaySessions.map((s) => s.id),
            ...weekSessions.map((s) => s.id),
            ...futureCandidates.map((s) => s.id),
        ]);
        const onlineLink = user?.psychologistSettings?.onlineSessionLink || null;
        const formattedSessions = todaySessions.map((session) => formatSession(session, paymentById, onlineLink));
        const formattedNextSession = nextSessionRaw ? formatSession(nextSessionRaw, paymentById, onlineLink) : null;

        const attentionItems: Array<{ type: string; count: number; label: string }> = [];
        const sessionsWithoutNotes = completedCandidates.filter((session) => !hasSessionNotes(session)).length;
        const clientsWithoutConsent = await db.diaryClient.count({ where: { psychologistId: auth.userId, consentDate: null, status: 'active' } });
        const unpaidCount = Number(unpaidPastSessions[0]?.count || 0);

        if (sessionsWithoutNotes > 0) attentionItems.push({ type: 'sessions_without_notes', count: sessionsWithoutNotes, label: 'Сессии без заметок' });
        if (clientsWithoutConsent > 0) attentionItems.push({ type: 'clients_without_consent', count: clientsWithoutConsent, label: 'Клиенты без согласия' });
        if (unpaidCount > 0) attentionItems.push({ type: 'sessions_unpaid', count: unpaidCount, label: 'Сессии без оплаты' });

        const notifications = notificationPage.items.map((item: any) => ({
            id: item.id,
            type: item.type,
            title: item.title,
            subtitle: item.subtitle,
            createdAt: item.createdAt?.toISOString?.() || item.createdAt,
            sessionId: item.sessionId,
            clientId: item.clientId,
            unread: !item.readAt,
        }));

        const bookingLink = clientBookingLink(auth.userId, '');
        const baseBookingLink = bookingLink.replace(/\/c\/[^?]+/, '');
        const clientIds = new Set(weekSessions.map(s => s.clientId).filter(Boolean));

        return NextResponse.json({
            todaySessions: formattedSessions,
            nextSession: formattedNextSession,
            weekStats: {
                sessionsCount: weekSessions.filter(s => s.status !== 'cancelled').length,
                newClients: clientIds.size,
                cancelledCount: weekSessions.filter(s => s.status === 'cancelled').length,
            },
            userName: user?.psychologistSettings?.fullName || user?.name || null,
            attentionItems,
            notifications,
            bookingLink: baseBookingLink,
        });
    } catch (error) {
        console.error('[mobile/dashboard]', error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
