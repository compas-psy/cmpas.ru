import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { exchangeCodeForTokens, getGoogleUserEmail, listGoogleCalendars } from '@/lib/calendar/google';

const BASE_URL = process.env.AUTH_URL || 'https://cmpas.ru';

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const rawState = searchParams.get('state'); // psychologistId or psychologistId|returnUrl
    const error = searchParams.get('error');

    // Parse state: may contain returnUrl for onboarding flow
    let state = rawState;
    let returnUrl: string | null = null;
    if (rawState && rawState.includes('|')) {
        const parts = rawState.split('|');
        state = parts[0];
        returnUrl = parts.slice(1).join('|');
    }

    if (error) {
        return NextResponse.redirect(`${BASE_URL}/diary/integrations?error=denied`);
    }

    if (!code || !state) {
        return NextResponse.redirect(`${BASE_URL}/diary/integrations?error=invalid`);
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

        const successRedirect = returnUrl
            ? `${BASE_URL}${returnUrl}?calendar_connected=google`
            : `${BASE_URL}/diary/integrations?success=google`;
        return NextResponse.redirect(successRedirect);
    } catch (err) {
        console.error('Google Calendar callback error:', err);
        const errorRedirect = returnUrl
            ? `${BASE_URL}${returnUrl}?calendar_error=google_failed`
            : `${BASE_URL}/diary/integrations?error=google_failed`;
        return NextResponse.redirect(errorRedirect);
    }
}
