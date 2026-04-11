import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { fetchGoogleCalendarEvents } from '@/lib/calendar/google';
import { extractClientNameFromSummary, aggregateCandidates } from '@/lib/clients/extract-name';
import { fetchYandexCalendarEvents } from '@/lib/calendar/yandex';

export async function GET(request: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const psychologistId = session.user.id;
    const days = parseInt(request.nextUrl.searchParams.get('days') || '90');
    const now = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const integrations = await db.calendarIntegration.findMany({
        where: { psychologistId, isActive: true },
    });

    const results = [];

    for (const integration of integrations) {
        let eventsResult: any;

        if (integration.provider === 'google') {
            eventsResult = await fetchGoogleCalendarEvents(integration.id, startDate, now);
        } else if (integration.provider === 'yandex') {
            eventsResult = await fetchYandexCalendarEvents(integration.id, startDate, now);
        } else {
            results.push({ provider: integration.provider, error: 'Unsupported' });
            continue;
        }

        if (!eventsResult.success || !eventsResult.events) {
            results.push({
                provider: integration.provider,
                accountEmail: integration.accountEmail,
                error: eventsResult.error,
            });
            continue;
        }

        const events = eventsResult.events;

        // Show ALL summaries with extraction results
        const allSummaries = events.map((e: any) => ({
            summary: e.summary,
            extracted: extractClientNameFromSummary(e.summary),
            start: e.start,
        }));

        // Show what names were extracted
        const extractedNames = allSummaries.filter((s: any) => s.extracted !== null);
        const failedExtractions = allSummaries.filter((s: any) => s.extracted === null);

        // Run aggregation
        const candidates = aggregateCandidates(events);

        results.push({
            provider: integration.provider,
            accountEmail: integration.accountEmail,
            totalEvents: events.length,
            extractedNames: extractedNames.length,
            failedExtractions: failedExtractions.length,
            candidates,
            // Show ALL summaries so we can debug what's failing
            allSummaries: allSummaries.slice(0, 100),
        });
    }

    return NextResponse.json({ psychologistId, days, results }, { status: 200 });
}
