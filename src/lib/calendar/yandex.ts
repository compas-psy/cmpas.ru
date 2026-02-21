// Yandex Calendar CalDAV service (via tsdav)

import { DAVClient } from 'tsdav';
import { db } from '@/lib/db';

// Yandex CalDAV server URL
const YANDEX_CALDAV_URL = 'https://caldav.yandex.ru';

/**
 * Create iCalendar event string from session data
 */
function createICalEvent(session: {
    id: string;
    date: Date;
    time: string;
    endTime: string | null;
    duration: number;
    type: string;
    format: string;
    notes: string | null;
    client?: { name: string } | null;
}): string {
    const dateStr = session.date.toISOString().split('T')[0].replace(/-/g, '');
    const startTime = session.time.replace(':', '') + '00';
    const endTime = session.endTime
        ? session.endTime.replace(':', '') + '00'
        : (() => {
            const [h, m] = session.time.split(':').map(Number);
            const endMin = h * 60 + m + session.duration;
            return `${String(Math.floor(endMin / 60)).padStart(2, '0')}${String(endMin % 60).padStart(2, '0')}00`;
        })();

    const now = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    const clientName = session.client?.name || 'Клиент';
    const typeLabel = session.type === 'individual' ? 'Индивидуальная' : session.type === 'couple' ? 'Парная' : session.type;
    const formatLabel = session.format === 'online' ? 'онлайн' : 'очно';

    return [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//Compas.ru//Diary//RU',
        'CALSCALE:GREGORIAN',
        'BEGIN:VEVENT',
        `UID:compas-session-${session.id}@cmpas.ru`,
        `DTSTAMP:${now}`,
        `DTSTART:${dateStr}T${startTime}`,
        `DTEND:${dateStr}T${endTime}`,
        `SUMMARY:${typeLabel} сессия — ${clientName}`,
        `DESCRIPTION:Формат: ${formatLabel}${session.notes ? '\\n' + session.notes : ''}`,
        'STATUS:CONFIRMED',
        'BEGIN:VALARM',
        'TRIGGER:-PT30M',
        'DESCRIPTION:Напоминание о сессии',
        'ACTION:DISPLAY',
        'END:VALARM',
        'END:VEVENT',
        'END:VCALENDAR',
    ].join('\r\n');
}

/**
 * Create a CalDAV client for Yandex Calendar
 */
async function createYandexClient(login: string, password: string): Promise<DAVClient> {
    const client = new DAVClient({
        serverUrl: YANDEX_CALDAV_URL,
        credentials: { username: login, password },
        authMethod: 'Basic',
        defaultAccountType: 'caldav',
    });
    await client.login();
    return client;
}

/**
 * Test CalDAV connection to Yandex Calendar
 */
export async function testYandexConnection(login: string, password: string): Promise<{
    success: boolean;
    calendars?: { displayName: string; url: string }[];
    error?: string;
}> {
    try {
        const client = await createYandexClient(login, password);
        const calendars = await client.fetchCalendars();
        return {
            success: true,
            calendars: calendars.map(c => ({
                displayName: String(c.displayName || 'Календарь'),
                url: c.url,
            })),
        };
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Неизвестная ошибка';
        return { success: false, error: message };
    }
}

/**
 * Push a session to Yandex Calendar via CalDAV
 */
export async function pushSessionToYandex(
    integrationId: string,
    session: Parameters<typeof createICalEvent>[0]
): Promise<{ success: boolean; error?: string }> {
    try {
        const integration = await db.calendarIntegration.findUnique({
            where: { id: integrationId },
        });
        if (!integration?.caldavLogin || !integration?.caldavPassword || !integration?.calendarId) {
            return { success: false, error: 'Интеграция не настроена' };
        }

        const client = await createYandexClient(integration.caldavLogin, integration.caldavPassword);
        const calendars = await client.fetchCalendars();
        const calendar = calendars.find(c => c.url === integration.calendarId) || calendars[0];

        if (!calendar) {
            return { success: false, error: 'Календарь не найден' };
        }

        const iCalString = createICalEvent(session);
        await client.createCalendarObject({
            calendar,
            iCalString,
            filename: `compas-session-${session.id}.ics`,
        });

        // Update last synced
        await db.calendarIntegration.update({
            where: { id: integrationId },
            data: { lastSynced: new Date() },
        });

        return { success: true };
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Ошибка синхронизации';
        return { success: false, error: message };
    }
}

/**
 * Sync all upcoming sessions to Yandex Calendar
 */
export async function syncAllSessionsToYandex(
    psychologistId: string
): Promise<{ success: boolean; synced: number; error?: string }> {
    try {
        const integration = await db.calendarIntegration.findUnique({
            where: { psychologistId_provider: { psychologistId, provider: 'yandex' } },
        });
        if (!integration?.isActive || !integration?.caldavLogin || !integration?.caldavPassword) {
            return { success: false, synced: 0, error: 'Интеграция не активна' };
        }

        // Get upcoming sessions
        const sessions = await db.diarySession.findMany({
            where: {
                psychologistId,
                date: { gte: new Date() },
                status: { in: ['confirmed', 'pending'] },
            },
            include: { client: { select: { name: true } } },
        });

        const client = await createYandexClient(integration.caldavLogin, integration.caldavPassword);
        const calendars = await client.fetchCalendars();
        const calendar = calendars.find(c => c.url === integration.calendarId) || calendars[0];

        if (!calendar) {
            return { success: false, synced: 0, error: 'Календарь не найден' };
        }

        let synced = 0;
        for (const session of sessions) {
            try {
                const iCalString = createICalEvent(session);
                await client.createCalendarObject({
                    calendar,
                    iCalString,
                    filename: `compas-session-${session.id}.ics`,
                });
                synced++;
            } catch {
                // Skip individual failures (e.g., event already exists)
            }
        }

        await db.calendarIntegration.update({
            where: { id: integration.id },
            data: { lastSynced: new Date() },
        });

        return { success: true, synced };
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Ошибка синхронизации';
        return { success: false, synced: 0, error: message };
    }
}
