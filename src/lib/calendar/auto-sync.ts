'use server';

import { db } from '@/lib/db';

/**
 * Auto-sync a session to all connected and active calendars.
 * Called after session create/update. Checks autoSync setting.
 */
export async function autoSyncSessionToCalendars(
    psychologistId: string,
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
) {
    try {
        // Check if autoSync is enabled
        const settings = await db.psychologistSettings.findUnique({
            where: { psychologistId },
            select: { autoSync: true },
        });

        if (!settings?.autoSync) return;

        // Get active integrations
        const integrations = await db.calendarIntegration.findMany({
            where: { psychologistId, isActive: true },
        });

        for (const integration of integrations) {
            try {
                if (integration.provider === 'google' && integration.accessToken) {
                    const { createGoogleCalendarEvent } = await import('@/lib/calendar/google');
                    await createGoogleCalendarEvent(integration.id, session);
                } else if (integration.provider === 'yandex' && integration.caldavLogin) {
                    const { pushSessionToYandex } = await import('@/lib/calendar/yandex');
                    await pushSessionToYandex(integration.id, session);
                }
            } catch (e) {
                console.error(`Auto-sync failed for ${integration.provider}:`, e);
            }
        }
    } catch (e) {
        console.error('autoSyncSessionToCalendars error:', e);
    }
}

/**
 * Auto-delete a session from all connected calendars.
 * Called after session delete/cancel.
 */
export async function autoDeleteSessionFromCalendars(
    psychologistId: string,
    sessionId: string
) {
    try {
        const settings = await db.psychologistSettings.findUnique({
            where: { psychologistId },
            select: { autoSync: true },
        });

        if (!settings?.autoSync) return;

        const integrations = await db.calendarIntegration.findMany({
            where: { psychologistId, isActive: true },
        });

        for (const integration of integrations) {
            try {
                if (integration.provider === 'google' && integration.accessToken) {
                    const { deleteGoogleCalendarEvent } = await import('@/lib/calendar/google');
                    await deleteGoogleCalendarEvent(integration.id, sessionId);
                }
                // For Yandex CalDAV, deleting individual events requires finding the object URL
                // which we don't store — would need additional logic or skip for now
            } catch (e) {
                console.error(`Auto-delete from ${integration.provider} failed:`, e);
            }
        }
    } catch (e) {
        console.error('autoDeleteSessionFromCalendars error:', e);
    }
}
