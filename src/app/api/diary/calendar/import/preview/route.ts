import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { fetchGoogleCalendarEvents } from '@/lib/calendar/google';

function cleanClientName(summary: string) {
    return summary
        .replace(/^(консультация|сессия|встреча|при[её]м)\s*[-—:]\s*/i, '')
        .replace(/\s*[-—:]\s*(консультация|сессия|встреча)$/i, '')
        .trim()
        .slice(0, 120) || 'Клиент из календаря';
}

export async function GET(req: NextRequest) {
    const session = await auth();
    const psychologistId = session?.user?.id;
    if (!psychologistId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const from = req.nextUrl.searchParams.get('from');
    const to = req.nextUrl.searchParams.get('to');
    const start = from ? new Date(from) : new Date();
    const end = to ? new Date(to) : new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);

    try {
        // Task 10 (founder review fix): the previous version derived
        // date/time with `date.getHours()`/`getMinutes()` — the SERVER's OS
        // timezone, not the practice's. A practice on Europe/Moscow with a
        // server running in UTC saw every candidate's time off by the UTC
        // offset. fetchGoogleCalendarEvents now resolves this itself, given
        // the practice's real timezone.
        const settings = await db.psychologistSettings.findUnique({
            where: { psychologistId },
            select: { timezone: true },
        });
        const timezone = settings?.timezone || 'Europe/Moscow';

        const integrations = await db.calendarIntegration.findMany({
            where: { psychologistId, isActive: true, provider: 'google', syncFrom: true },
        });
        const existing = await db.diarySession.findMany({
            where: { psychologistId, date: { gte: start, lte: end }, status: { not: 'cancelled' } },
            include: { client: { select: { name: true } } },
        });
        const existingKeys = new Set(existing.map((item) => {
            const date = item.date.toISOString().slice(0, 10);
            return `${date}|${item.time}|${(item.client?.name || '').toLowerCase().trim()}`;
        }));

        const candidates: Array<Record<string, unknown>> = [];
        for (const integration of integrations) {
            // includeCompasEvents: false (the default) already drops events
            // PRAKTIKA itself created and pushed here — those aren't import
            // candidates, they're our own sessions looping back.
            const result = await fetchGoogleCalendarEvents(integration.id, start, end, { timezone });
            if (!result.success || !result.events) continue;
            for (const event of result.events) {
                // All-day entries ("Отпуск", a public holiday, ...) are not
                // bookable client sessions — Task 11 will build real
                // classification, but an all-day span is never a candidate.
                if (event.allDay) continue;

                const clientName = cleanClientName(event.summary);
                const key = `${event.date}|${event.startTime}|${clientName.toLowerCase().trim()}`;
                candidates.push({
                    // Task 10: the provider's own stable id — never a hash of
                    // display fields, which change and can collide. Tasks
                    // 11/12 (matching, idempotent commit) key off this.
                    id: `${integration.provider}:${integration.id}:${event.externalEventId}`,
                    provider: integration.provider,
                    calendarId: integration.calendarId,
                    summary: event.summary,
                    clientName,
                    date: event.date,
                    startTime: event.startTime,
                    endTime: event.endTime,
                    duration: Math.max(15, Math.round((event.end.getTime() - event.start.getTime()) / 60000)),
                    duplicate: existingKeys.has(key),
                });
            }
        }

        return NextResponse.json({ items: candidates, count: candidates.length, importableCount: candidates.filter((i) => !i.duplicate).length });
    } catch (error) {
        console.error('[calendar/import/preview GET]', error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
