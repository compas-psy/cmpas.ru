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

function minutes(date: Date) {
    return String(date.getHours()).padStart(2, '0') + ':' + String(date.getMinutes()).padStart(2, '0');
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
            const result = await fetchGoogleCalendarEvents(integration.id, start, end, { includeCompasEvents: false });
            if (!result.success || !result.events) continue;
            for (const event of result.events) {
                const date = event.start.toISOString().slice(0, 10);
                const startTime = minutes(event.start);
                const endTime = minutes(event.end);
                const clientName = cleanClientName(event.summary);
                const key = `${date}|${startTime}|${clientName.toLowerCase().trim()}`;
                candidates.push({
                    id: Buffer.from(`${integration.id}|${event.summary}|${event.start.toISOString()}`).toString('base64url'),
                    provider: integration.provider,
                    calendarId: integration.calendarId,
                    summary: event.summary,
                    clientName,
                    date,
                    startTime,
                    endTime,
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
