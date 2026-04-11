import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { extractClientNameFromSummary, aggregateCandidates } from '@/lib/clients/extract-name';

export async function GET(request: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const psychologistId = session.user.id;
    const now = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 90);

    // Get all integrations for this user
    const integrations = await db.calendarIntegration.findMany({
        where: { psychologistId },
    });

    const results = [];

    for (const integration of integrations) {
        const tokenInfo = {
            hasAccessToken: !!integration.accessToken,
            hasRefreshToken: !!integration.refreshToken,
            tokenExpiry: integration.tokenExpiry,
            isExpired: integration.tokenExpiry
                ? integration.tokenExpiry < new Date()
                : null,
            expiresInMinutes: integration.tokenExpiry
                ? Math.round((integration.tokenExpiry.getTime() - Date.now()) / 60000)
                : null,
        };

        // Try to fetch events via API
        const GOOGLE_CALENDAR_API = 'https://www.googleapis.com/calendar/v3';
        const params = new URLSearchParams({
            timeMin: startDate.toISOString(),
            timeMax: now.toISOString(),
            singleEvents: 'true',
            orderBy: 'startTime',
            showDeleted: 'false',
            maxResults: '200',
        });

        let apiStatus: any = null;
        let rawEvents: any[] = [];
        let sampleNames: { summary: string; extracted: string | null }[] = [];
        let candidates: any[] = [];

        if (integration.accessToken) {
            try {
                const res = await fetch(
                    `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(integration.calendarId || 'primary')}/events?${params}`,
                    { headers: { Authorization: `Bearer ${integration.accessToken}` } }
                );
                const body = await res.json();
                apiStatus = { status: res.status, ok: res.ok, error: body.error };
                if (res.ok) {
                    rawEvents = (body.items || []).slice(0, 50);
                    sampleNames = rawEvents.slice(0, 20).map((e: any) => ({
                        summary: e.summary || '(no summary)',
                        extracted: extractClientNameFromSummary(e.summary),
                    }));
                    // Run aggregation on ALL events
                    const allEvents = body.items || [];
                    const mappedEvents = allEvents
                        .filter((e: any) => e.status !== 'cancelled' && e.summary)
                        .map((e: any) => ({
                            summary: e.summary,
                            start: new Date(e.start?.dateTime || e.start?.date || 0),
                            end: new Date(e.end?.dateTime || e.end?.date || 0),
                        }));
                    candidates = aggregateCandidates(mappedEvents);
                }
            } catch (e: any) {
                apiStatus = { error: e.message };
            }
        }

        results.push({
            provider: integration.provider,
            calendarId: integration.calendarId,
            accountEmail: integration.accountEmail,
            tokenInfo,
            apiStatus,
            totalRawEvents: rawEvents.length,
            sampleNames,
            candidates,
        });
    }

    return NextResponse.json({ psychologistId, results });
}
