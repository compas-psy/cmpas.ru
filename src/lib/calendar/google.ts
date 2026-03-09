// Google Calendar OAuth2 + REST API service

import { db } from '@/lib/db';

// Google OAuth2 constants
const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_CALENDAR_API = 'https://www.googleapis.com/calendar/v3';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CALENDAR_CLIENT_ID || '';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CALENDAR_CLIENT_SECRET || '';
const REDIRECT_URI = `${process.env.AUTH_URL || 'https://cmpas.ru'}/api/calendar/google/callback`;

const SCOPES = [
    'https://www.googleapis.com/auth/calendar.events',
    'https://www.googleapis.com/auth/calendar.readonly',
    'openid',
    'email',
].join(' ');

/**
 * Generate Google OAuth2 authorization URL
 */
export function getGoogleAuthUrl(psychologistId: string): string {
    const params = new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        redirect_uri: REDIRECT_URI,
        response_type: 'code',
        scope: SCOPES,
        access_type: 'offline',
        prompt: 'consent',
        state: psychologistId, // pass psychologist ID in state
    });
    return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

/**
 * Exchange authorization code for tokens
 */
export async function exchangeCodeForTokens(code: string): Promise<{
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    token_type: string;
}> {
    const response = await fetch(GOOGLE_TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            code,
            client_id: GOOGLE_CLIENT_ID,
            client_secret: GOOGLE_CLIENT_SECRET,
            redirect_uri: REDIRECT_URI,
            grant_type: 'authorization_code',
        }),
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to exchange code: ${error}`);
    }

    return response.json();
}

/**
 * Refresh access token using refresh token
 */
export async function refreshAccessToken(refreshToken: string): Promise<{
    access_token: string;
    expires_in: number;
}> {
    const response = await fetch(GOOGLE_TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            refresh_token: refreshToken,
            client_id: GOOGLE_CLIENT_ID,
            client_secret: GOOGLE_CLIENT_SECRET,
            grant_type: 'refresh_token',
        }),
    });

    if (!response.ok) {
        throw new Error('Failed to refresh token');
    }

    return response.json();
}

/**
 * Get a valid access token (refresh if expired)
 */
async function getValidToken(integrationId: string): Promise<string> {
    const integration = await db.calendarIntegration.findUnique({
        where: { id: integrationId },
    });

    if (!integration?.accessToken || !integration?.refreshToken) {
        throw new Error('No tokens available');
    }

    // Check if token is expired (with 5-minute buffer)
    if (integration.tokenExpiry && integration.tokenExpiry < new Date(Date.now() + 5 * 60 * 1000)) {
        const tokens = await refreshAccessToken(integration.refreshToken);
        await db.calendarIntegration.update({
            where: { id: integrationId },
            data: {
                accessToken: tokens.access_token,
                tokenExpiry: new Date(Date.now() + tokens.expires_in * 1000),
            },
        });
        return tokens.access_token;
    }

    return integration.accessToken;
}

/**
 * Get user's email from Google
 */
export async function getGoogleUserEmail(accessToken: string): Promise<string> {
    const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` },
    });
    const data = await response.json();
    return data.email || '';
}

/**
 * List user's Google Calendars
 */
export async function listGoogleCalendars(accessToken: string): Promise<{
    id: string;
    summary: string;
    primary: boolean;
}[]> {
    const response = await fetch(`${GOOGLE_CALENDAR_API}/users/me/calendarList`, {
        headers: { Authorization: `Bearer ${accessToken}` },
    });
    const data = await response.json();
    return (data.items || []).map((c: { id: string; summary: string; primary?: boolean }) => ({
        id: c.id,
        summary: c.summary,
        primary: c.primary || false,
    }));
}

/**
 * Create a calendar event in Google Calendar
 */
export async function createGoogleCalendarEvent(
    integrationId: string,
    session: {
        id: string;
        date: Date;
        time: string;
        endTime: string | null;
        duration: number;
        type: string;
        format: string;
        notes: string | null;
        client?: { name: string } | null;
    }
): Promise<{ success: boolean; eventId?: string; error?: string }> {
    try {
        const integration = await db.calendarIntegration.findUnique({
            where: { id: integrationId },
        });
        if (!integration?.calendarId) {
            return { success: false, error: 'Календарь не выбран' };
        }

        const accessToken = await getValidToken(integrationId);

        const dateStr = session.date.toISOString().split('T')[0];
        const endTime = session.endTime || (() => {
            const [h, m] = session.time.split(':').map(Number);
            const endMin = h * 60 + m + session.duration;
            return `${String(Math.floor(endMin / 60)).padStart(2, '0')}:${String(endMin % 60).padStart(2, '0')}`;
        })();

        const clientName = session.client?.name || 'Клиент';
        const typeLabel = session.type === 'individual' ? 'Индивидуальная' : session.type === 'couple' ? 'Парная' : session.type;
        const formatLabel = session.format === 'online' ? 'онлайн' : 'очно';

        const event = {
            summary: `${typeLabel} сессия — ${clientName}`,
            description: `Формат: ${formatLabel}${session.notes ? '\n' + session.notes : ''}`,
            start: {
                dateTime: `${dateStr}T${session.time}:00`,
                timeZone: 'Europe/Moscow',
            },
            end: {
                dateTime: `${dateStr}T${endTime}:00`,
                timeZone: 'Europe/Moscow',
            },
            reminders: {
                useDefault: false,
                overrides: [
                    { method: 'popup', minutes: 30 },
                ],
            },
            // Store session ID for reference
            extendedProperties: {
                private: { compasSessionId: session.id },
            },
        };

        const response = await fetch(
            `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(integration.calendarId)}/events`,
            {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(event),
            }
        );

        if (!response.ok) {
            const err = await response.text();
            return { success: false, error: `Google API error: ${err}` };
        }

        const created = await response.json();

        await db.calendarIntegration.update({
            where: { id: integrationId },
            data: { lastSynced: new Date() },
        });

        return { success: true, eventId: created.id };
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Ошибка синхронизации';
        return { success: false, error: message };
    }
}

/**
 * Delete a calendar event from Google Calendar by session ID
 */
export async function deleteGoogleCalendarEvent(
    integrationId: string,
    sessionId: string
): Promise<{ success: boolean; error?: string }> {
    try {
        const integration = await db.calendarIntegration.findUnique({
            where: { id: integrationId },
        });
        if (!integration?.calendarId) {
            return { success: false, error: 'Календарь не выбран' };
        }

        const accessToken = await getValidToken(integrationId);

        // Search for the event by extendedProperties
        const searchUrl = `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(integration.calendarId)}/events?privateExtendedProperty=compasSessionId%3D${sessionId}`;
        const searchRes = await fetch(searchUrl, {
            headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (!searchRes.ok) {
            return { success: false, error: 'Не удалось найти событие' };
        }

        const searchData = await searchRes.json();
        const events = searchData.items || [];

        for (const event of events) {
            await fetch(
                `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(integration.calendarId)}/events/${event.id}`,
                {
                    method: 'DELETE',
                    headers: { Authorization: `Bearer ${accessToken}` },
                }
            );
        }

        return { success: true };
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Ошибка удаления события';
        return { success: false, error: message };
    }
}

/**
 * Sync all upcoming sessions to Google Calendar
 */
export async function syncAllSessionsToGoogle(
    psychologistId: string
): Promise<{ success: boolean; synced: number; error?: string }> {
    try {
        const integration = await db.calendarIntegration.findUnique({
            where: { psychologistId_provider: { psychologistId, provider: 'google' } },
        });
        if (!integration?.isActive || !integration?.accessToken) {
            return { success: false, synced: 0, error: 'Интеграция не активна' };
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const sessions = await db.diarySession.findMany({
            where: {
                psychologistId,
                date: { gte: today },
                status: { in: ['confirmed', 'pending'] },
            },
            include: { client: { select: { name: true } } },
        });

        let synced = 0;
        for (const session of sessions) {
            const result = await createGoogleCalendarEvent(integration.id, session);
            if (result.success) {
                synced++;
            } else {
                console.error(`Failed to sync session ${session.id} to Google:`, result.error);
            }
        }

        return { success: true, synced };
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Ошибка синхронизации';
        return { success: false, synced: 0, error: message };
    }
}

/**
 * Fetch events from Google Calendar within a date range
 */
export async function fetchGoogleCalendarEvents(
    integrationId: string,
    startDate: Date,
    endDate: Date
): Promise<{ success: boolean; events?: { start: Date; end: Date; summary: string }[]; error?: string }> {
    try {
        const integration = await db.calendarIntegration.findUnique({
            where: { id: integrationId },
        });
        if (!integration?.calendarId) {
            return { success: false, error: 'Календарь не выбран' };
        }

        const accessToken = await getValidToken(integrationId);

        // Fetch events in time range, ignoring deleted ones
        const params = new URLSearchParams({
            timeMin: startDate.toISOString(),
            timeMax: endDate.toISOString(),
            singleEvents: 'true', // Expand recurring events
            orderBy: 'startTime',
            showDeleted: 'false',
        });

        const response = await fetch(
            `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(integration.calendarId)}/events?${params.toString()}`,
            {
                headers: { Authorization: `Bearer ${accessToken}` },
            }
        );

        if (!response.ok) {
            const err = await response.text();
            return { success: false, error: `Google API error: ${err}` };
        }

        const data = await response.json();
        const items = data.items || [];

        const events = items
            .filter((item: any) => item.status !== 'cancelled' && item.transparency !== 'transparent') // skip Free slots
            .map((item: any) => {
                let start, end;
                if (item.start.dateTime) {
                    start = new Date(item.start.dateTime);
                    end = new Date(item.end.dateTime);
                } else if (item.start.date) {
                    // All-day event
                    start = new Date(item.start.date);
                    end = new Date(item.end.date);
                } else {
                    return null;
                }

                return {
                    start,
                    end,
                    summary: item.summary || 'Busy',
                };
            })
            .filter(Boolean);

        return { success: true, events };
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Ошибка запроса Google Calendar';
        return { success: false, error: message };
    }
}
