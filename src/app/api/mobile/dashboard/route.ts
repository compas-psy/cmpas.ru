import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { authenticateMobileRequest, unauthorizedResponse } from '@/lib/mobile-auth';
import { clientBookingLink } from '@/lib/client-workflow';

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
    `);
    return new Map(rows.map((row) => [row.id, row.paymentStatus]));
}

export async function GET(req: NextRequest) {
    const auth = await authenticateMobileRequest(req);
    if (!auth) return unauthorizedResponse();

    try {
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
        const weekAgo = new Date(today); weekAgo.setDate(weekAgo.getDate() - 7);
        const twoDaysAhead = new Date(); twoDaysAhead.setDate(twoDaysAhead.getDate() + 2);

        const [todaySessions, weekSessions, user, recentSessions, homeworkEvents] = await Promise.all([
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
                    updatedAt: { gte: weekAgo },
                    OR: [
                        { status: 'cancelled' },
                        { status: 'confirmed' },
                        { status: 'pending', date: { gte: new Date(), lte: twoDaysAhead } },
                    ],
                },
                include: { client: { select: { id: true, name: true } } },
                orderBy: { updatedAt: 'desc' },
                take: 20,
            }),
            db.homework.findMany({
                where: {
                    psychologistId: auth.userId,
                    updatedAt: { gte: weekAgo },
                    OR: [{ status: 'completed' }, { clientFeedback: { not: null } }],
                },
                include: { client: { select: { id: true, name: true } } },
                orderBy: { updatedAt: 'desc' },
                take: 10,
            }),
        ]);

        const paymentById = await paymentStatusMap([...todaySessions.map((s) => s.id), ...weekSessions.map((s) => s.id)]);
        const onlineLink = user?.psychologistSettings?.onlineSessionLink || null;
        const now = new Date();
        const formattedSessions = todaySessions.map(s => ({
            id: s.id,
            clientId: s.client?.id || '',
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
        }));

        const nextSession = todaySessions.find(s => {
            const d = new Date(s.date);
            const [h, m] = (s.time || '00:00').split(':').map(Number);
            d.setHours(h, m);
            return d > now;
        });

        const attentionItems: Array<{ type: string; count: number; label: string }> = [];
        const [sessionsWithoutNotes, clientsWithoutConsent, unpaidPastSessions] = await Promise.all([
            db.diarySession.count({
                where: {
                    psychologistId: auth.userId,
                    status: 'completed',
                    notes: null,
                    date: { lte: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000) },
                },
            }),
            db.diaryClient.count({ where: { psychologistId: auth.userId, consentDate: null, status: 'active' } }),
            db.$queryRaw<Array<{ count: bigint }>>`
                SELECT COUNT(*)::bigint as count
                FROM "DiarySession"
                WHERE "psychologistId" = ${auth.userId}
                  AND status = 'completed'
                  AND "paymentStatus" = 'unpaid'
            `,
        ]);
        if (sessionsWithoutNotes > 0) attentionItems.push({ type: 'sessions_without_notes', count: sessionsWithoutNotes, label: 'Сессии без заметок' });
        if (clientsWithoutConsent > 0) attentionItems.push({ type: 'clients_without_consent', count: clientsWithoutConsent, label: 'Клиенты без согласия' });
        const unpaidCount = Number(unpaidPastSessions[0]?.count || 0);
        if (unpaidCount > 0) attentionItems.push({ type: 'sessions_unpaid', count: unpaidCount, label: 'Сессии без оплаты' });

        const notifications: Array<Record<string, unknown>> = [];
        for (const session of recentSessions) {
            const date = session.date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
            const type = session.status === 'cancelled' ? 'session_cancelled' : session.status === 'confirmed' ? 'session_confirmed' : 'session_pending';
            const title = session.status === 'cancelled' ? 'Сессия отменена' : session.status === 'confirmed' ? 'Сессия подтверждена' : 'Ожидается подтверждение';
            notifications.push({
                id: `session-${session.id}-${session.status}`,
                type,
                title,
                subtitle: `${session.client?.name || 'Клиент'} · ${date}, ${session.time}`,
                createdAt: session.updatedAt.toISOString(),
                sessionId: session.id,
                clientId: session.client?.id || null,
                unread: true,
            });
        }
        for (const homework of homeworkEvents) {
            notifications.push({
                id: `homework-${homework.id}`,
                type: 'homework_received',
                title: 'Домашнее задание от клиента',
                subtitle: `${homework.client.name} · ${homework.title}`,
                createdAt: homework.updatedAt.toISOString(),
                sessionId: homework.sessionId,
                clientId: homework.client.id,
                unread: true,
            });
        }

        try {
            const documentEvents = await db.$queryRaw<Array<{
                id: string;
                status: string;
                documentTitle: string;
                openedAt: Date | null;
                acknowledgedAt: Date | null;
                updatedAt: Date;
                clientId: string;
                clientName: string;
                sessionId: string | null;
            }>>`
                SELECT d.id, d.status, d."documentTitle", d."openedAt", d."acknowledgedAt", d."updatedAt",
                       d."clientId", d."sessionId", c.name as "clientName"
                FROM "ClientDocumentDelivery" d
                JOIN "DiaryClient" c ON c.id = d."clientId"
                WHERE d."psychologistId" = ${auth.userId}
                  AND d."updatedAt" >= ${weekAgo}
                  AND (d."openedAt" IS NOT NULL OR d."acknowledgedAt" IS NOT NULL)
                ORDER BY d."updatedAt" DESC
                LIMIT 20
            `;
            for (const doc of documentEvents) {
                const acknowledged = !!doc.acknowledgedAt;
                notifications.push({
                    id: `document-${doc.id}-${doc.status}`,
                    type: acknowledged ? 'document_acknowledged' : 'document_opened',
                    title: acknowledged ? 'Документ подтверждён' : 'Документ открыт',
                    subtitle: `${doc.clientName} · ${doc.documentTitle}`,
                    createdAt: (doc.acknowledgedAt || doc.openedAt || doc.updatedAt).toISOString(),
                    sessionId: doc.sessionId,
                    clientId: doc.clientId,
                    unread: true,
                });
            }
        } catch (error) {
            console.warn('[mobile/dashboard] document events unavailable', error);
        }

        notifications.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));

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
            notifications: notifications.slice(0, 30),
            bookingLink: baseBookingLink,
        });
    } catch (error) {
        console.error('[mobile/dashboard]', error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
