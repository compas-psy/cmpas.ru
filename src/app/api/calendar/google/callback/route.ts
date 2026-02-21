import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { exchangeCodeForTokens, getGoogleUserEmail, listGoogleCalendars } from '@/lib/calendar/google';

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state'); // psychologistId
    const error = searchParams.get('error');

    if (error) {
        return NextResponse.redirect(new URL('/diary/integrations?error=denied', request.url));
    }

    if (!code || !state) {
        return NextResponse.redirect(new URL('/diary/integrations?error=invalid', request.url));
    }

    try {
        // Exchange code for tokens
        const tokens = await exchangeCodeForTokens(code);

        // Get user email
        const email = await getGoogleUserEmail(tokens.access_token);

        // Get primary calendar
        const calendars = await listGoogleCalendars(tokens.access_token);
        const primaryCalendar = calendars.find(c => c.primary) || calendars[0];

        // Create or update integration
        await db.calendarIntegration.upsert({
            where: {
                psychologistId_provider: {
                    psychologistId: state,
                    provider: 'google',
                },
            },
            create: {
                psychologistId: state,
                provider: 'google',
                accountEmail: email,
                accessToken: tokens.access_token,
                refreshToken: tokens.refresh_token || null,
                tokenExpiry: new Date(Date.now() + tokens.expires_in * 1000),
                calendarId: primaryCalendar?.id || 'primary',
                isActive: true,
            },
            update: {
                accountEmail: email,
                accessToken: tokens.access_token,
                refreshToken: tokens.refresh_token || undefined,
                tokenExpiry: new Date(Date.now() + tokens.expires_in * 1000),
                calendarId: primaryCalendar?.id || 'primary',
                isActive: true,
            },
        });

        return NextResponse.redirect(new URL('/diary/integrations?success=google', request.url));
    } catch (err) {
        console.error('Google Calendar callback error:', err);
        return NextResponse.redirect(new URL('/diary/integrations?error=google_failed', request.url));
    }
}
