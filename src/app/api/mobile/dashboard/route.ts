import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { authenticateMobileRequest, unauthorizedResponse } from '@/lib/mobile-auth';
import { clientBookingLink } from '@/lib/client-workflow';
import { getPsychologistBookingUrl } from '@/lib/booking/slug';
import { listNotifications } from '@/lib/notifications';
import { compareSessionStart, isSessionFuture, settlePastSessionsForPsychologist } from '@/lib/session-maintenance';
import { getPracticeAttention } from '@/lib/practice/attention';
import { getPracticeOnboarding } from '@/lib/practice/onboarding';

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
        await settlePastSessionsForPsychologist(auth.userId).catch((error) => {
            console.error('[mobile/dashboard] settle skipped:', error);
        });

        const now = new Date();
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
        const weekAgo = new Date(today); weekAgo.setDate(weekAgo.getDate() - 7);
        const horizon = new Date(today); horizon.setDate(horizon.getDate() + 30);

        const [todaySessions, weekSessions, user, futureCandidates, attentionItems, notificationPage] = await Promise.all([
            db.diarySession.findMany({
                where: { psychologistId: auth.userId, date: { gte: today, lt: tomorrow }, status: { not: 'cancelled' } },
                include: { client: { select: { id: true, name: true } } },
                orderBy: { time: 'asc' },
            }),
            db.diarySession.findMany({ where: { psychologistId: auth.userId, date: { gte: weekAgo, lt: tomorrow } }, select: { id: true, status: true, clientId: true } }),
            db.user.findUnique({
                where: { id: auth.userId },
                select: { name: true, psychologistSettings: { select: { fullName: true, onlineSessionLink: true, onboardingCompleted: true } } },
            }),
            db.diarySession.findMany({
                where: { psychologistId: auth.userId, date: { gte: today, lte: horizon }, status: { in: ['pending', 'confirmed'] } },
                include: { client: { select: { id: true, name: true } } },
                orderBy: [{ date: 'asc' }, { time: 'asc' }],
                take: 60,
            }),
            // Задача 17: «требует внимания» больше не считается здесь тремя
            // отдельными счётчиками — и веб, и мобайл берут одни и те же
            // конкретные пункты с идентификаторами из общего Action Center.
            getPracticeAttention(auth.userId, now).catch(() => []),
            listNotifications(auth.userId, { limit: 30 }).catch(() => ({ items: [] })),
        ]);

        const nextSessionRaw = futureCandidates.filter((session) => isSessionFuture(session, now)).sort(compareSessionStart)[0] || null;

        const paymentById = await paymentStatusMap([
            ...todaySessions.map((s) => s.id),
            ...weekSessions.map((s) => s.id),
            ...futureCandidates.map((s) => s.id),
        ]);
        const onlineLink = user?.psychologistSettings?.onlineSessionLink || null;
        const formattedSessions = todaySessions.map((session) => formatSession(session, paymentById, onlineLink));
        const formattedNextSession = nextSessionRaw ? formatSession(nextSessionRaw, paymentById, onlineLink) : null;

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

        // §5.1 (O-260829): human-readable /u/<slug> link for the Android app's
        // "Ссылка для записи" — assigns a slug on first use, falls back to
        // the old /bot/book/<id> form if slug resolution fails.
        const onboarding = await getPracticeOnboarding(auth.userId);

        const slugBase = await getPsychologistBookingUrl(auth.userId).catch(() => null);
        const bookingLink = clientBookingLink(auth.userId, '', slugBase || undefined);
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
            // Задача 24: то же состояние онбординга, что и в вебе — из общего
            // ядра, а не своя мобильная трактовка.
            onboarding,
            // Старые поля остаются ради уже установленных сборок, но теперь
            // выводятся из того же состояния: подсказку показывать, пока
            // чек-лист не пройден и не скрыт. Прежний грубый
            // onboardingCompleted здесь больше ничего не решает.
            needsOnboarding: !onboarding.completed && !onboarding.dismissed,
            onboardingUrl: '/onboarding',
            attentionItems,
            notifications,
            bookingLink: baseBookingLink,
        });
    } catch (error) {
        console.error('[mobile/dashboard]', error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
