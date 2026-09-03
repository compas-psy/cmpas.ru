import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { fetchGoogleCalendarEvents } from '@/lib/calendar/google';
import { fetchYandexCalendarEvents } from '@/lib/calendar/yandex';
import { practiceImportRange } from '@/lib/practice/migration/import-range';
import { classifyCalendarEvents, importCandidateDedupeKey, countByReviewState } from '@/lib/practice/migration/classify';
import type { PracticeSourceEvent } from '@/lib/practice/migration/types';

export async function GET() {
    const session = await auth();
    const psychologistId = session?.user?.id;
    if (!psychologistId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const settings = await db.psychologistSettings.findUnique({
            where: { psychologistId },
            select: { timezone: true },
        });
        const timezone = settings?.timezone || 'Europe/Moscow';

        // Task 11 (founder review of Task 10, item 5): the old 60-day-from-now
        // query-param window is gone — this is the flow practiceImportRange
        // was built for. Import only ever looks at future sessions, per
        // docs/tz-cjm-audit-beta2.md IMPORT-1: "будущие события (от сегодня)".
        const { start, end } = practiceImportRange(timezone);

        // Task 11: the old route only ever read Google integrations —
        // Yandex went through fetchYandexCalendarEvents (Task 10) but was
        // never wired into import preview at all.
        const integrations = await db.calendarIntegration.findMany({
            where: { psychologistId, isActive: true, syncFrom: true, provider: { in: ['google', 'yandex'] } },
        });

        const events: PracticeSourceEvent[] = [];
        for (const integration of integrations) {
            const result = integration.provider === 'google'
                ? await fetchGoogleCalendarEvents(integration.id, start, end, { timezone })
                : await fetchYandexCalendarEvents(integration.id, start, end, { timezone });
            if (result.success && result.events) events.push(...result.events);
        }

        const [existingClients, existingSessions] = await Promise.all([
            db.diaryClient.findMany({ where: { psychologistId }, select: { id: true, name: true, phone: true, email: true } }),
            db.diarySession.findMany({
                where: { psychologistId, date: { gte: start, lte: end }, status: { not: 'cancelled' } },
                include: { client: { select: { name: true } } },
            }),
        ]);

        const existingSessionKeys = new Set(
            existingSessions.map((s) => importCandidateDedupeKey(s.date.toISOString().slice(0, 10), s.time, s.client?.name || ''))
        );

        // Task 11 (founder correction): classification (extract-name.ts —
        // 'session'/'personal'/'uncertain'/'skipped') and matching
        // (suggestedClientId vs. resolvedClientId — a name is NEVER an
        // auto-match, see src/lib/clients/match.ts) both happen here.
        const items = classifyCalendarEvents(events, existingClients, existingSessionKeys);

        return NextResponse.json({ items, counts: countByReviewState(items) });
    } catch (error) {
        console.error('[calendar/import/preview GET]', error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
