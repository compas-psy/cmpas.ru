import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { fetchGoogleCalendarEvents } from '@/lib/calendar/google';
import { extractClientNameFromSummary } from '@/lib/clients/extract-name';

export async function GET(request: NextRequest) {
    const session = await auth();
    const userRole = (session?.user as { role?: string })?.role;
    if (!session?.user || (userRole !== 'ADMIN' && userRole !== 'SUPERADMIN')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const userId = request.nextUrl.searchParams.get('userId');
    if (!userId) {
        return NextResponse.json({ error: 'userId required' }, { status: 400 });
    }

    // Get integrations
    const integrations = await db.calendarIntegration.findMany({
        where: { psychologistId: userId },
    });

    if (integrations.length === 0) {
        return NextResponse.json({ error: 'No integrations found', userId });
    }

    const integration = integrations[0];
    const now = new Date();

    // Try fetching events
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 90);

    let eventsResult: any = null;
    try {
        eventsResult = await fetchGoogleCalendarEvents(integration.id, startDate, now);
    } catch (e: any) {
        eventsResult = { success: false, error: e.message };
    }

    // Sample name extraction on first 5 events
    const sampleNames = (eventsResult?.events || []).slice(0, 20).map((e: any) => ({
        summary: e.summary,
        extracted: extractClientNameFromSummary(e.summary),
    }));

    return NextResponse.json({
        integration: {
            id: integration.id,
            provider: integration.provider,
            calendarId: integration.calendarId,
            accountEmail: integration.accountEmail,
            isActive: integration.isActive,
            tokenExpiry: integration.tokenExpiry,
            hasAccessToken: !!integration.accessToken,
            hasRefreshToken: !!integration.refreshToken,
            tokenExpiryMs: integration.tokenExpiry
                ? integration.tokenExpiry.getTime() - Date.now()
                : null,
        },
        eventsResult: {
            success: eventsResult?.success,
            error: eventsResult?.error,
            totalEvents: eventsResult?.events?.length || 0,
        },
        sampleNames,
    });
}
