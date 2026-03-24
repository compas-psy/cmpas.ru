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

/**
 * Fetch events from Yandex Calendar within a date range
 */
export async function fetchYandexCalendarEvents(
    integrationId: string,
    startDate: Date,
    endDate: Date
): Promise<{ success: boolean; events?: { start: Date; end: Date; summary: string }[]; error?: string }> {
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

        // tsdav requires ISO 8601 format for timeRange (e.g. 2024-01-01T00:00:00.000Z)
        const formatStrDate = (d: Date) => d.toISOString();

        const objects = await client.fetchCalendarObjects({
            calendar,
            timeRange: {
                start: formatStrDate(startDate),
                end: formatStrDate(endDate),
            },
            expand: true
        });

        const events: { start: Date; end: Date; summary: string }[] = [];

        // Parse rudimentary iCal strings returned by tsdav
        // Parse iCal date string: returns UTC date + optional localStr for floating (no Z) times
        const parseIcalDateStr = (str: string) => {
            const isUTC = str.endsWith('Z');
            str = str.replace(/Z$/, '').trim();
            let date, localStr = undefined;

            if (str.length === 8) {
                date = new Date(`${str.slice(0, 4)}-${str.slice(4, 6)}-${str.slice(6, 8)}T00:00:00Z`);
                return { date, localStr: `${str.slice(0, 4)}-${str.slice(4, 6)}-${str.slice(6, 8)}T00:00:00` };
            }

            const time = `${str.slice(9, 11)}:${str.slice(11, 13)}:${str.slice(13, 15)}`;
            date = new Date(`${str.slice(0, 4)}-${str.slice(4, 6)}-${str.slice(6, 8)}T${time}Z`);

            if (!isUTC) {
                localStr = `${str.slice(0, 4)}-${str.slice(4, 6)}-${str.slice(6, 8)}T${time}`;
            }

            return { date, localStr };
        };

        for (const obj of objects) {
            if (!obj.data) continue;

            // Check if it's explicitly marked FREE (TRANSP:TRANSPARENT)
            if (obj.data.includes('TRANSP:TRANSPARENT') || obj.data.includes('STATUS:CANCELLED')) {
                continue;
            }

            // VFREEBUSY components: parse FREEBUSY lines for actual busy intervals.
            if (obj.data.includes('BEGIN:VFREEBUSY')) {
                const vfbMatch = obj.data.match(/BEGIN:VFREEBUSY[\s\S]*?END:VFREEBUSY/);
                const vfbData = vfbMatch ? vfbMatch[0] : obj.data;
                const summaryMatch = vfbData.match(/(?:SUMMARY|COMMENT):(.*)/);
                const summary = summaryMatch ? summaryMatch[1].trim() : 'BUSY';
                const freebusyRegex = /^FREEBUSY(?:;([^:]+))?:(.+)$/mg;
                let fbMatch;
                while ((fbMatch = freebusyRegex.exec(vfbData)) !== null) {
                    const params = (fbMatch[1] || '').toUpperCase();
                    if (params.includes('FBTYPE=FREE')) continue;
                    const periods = fbMatch[2].trim().split(',');
                    for (const period of periods) {
                        const parts = period.trim().split('/');
                        if (parts.length !== 2) continue;
                        const startParsed = parseIcalDateStr(parts[0].trim());
                        const endStr = parts[1].trim();
                        let endDate: Date, endLocalStr: string | undefined;
                        if (endStr.startsWith('P')) {
                            const dm = endStr.match(/P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
                            if (!dm) continue;
                            const ms = (parseInt(dm[1] || '0') * 86400 + parseInt(dm[2] || '0') * 3600 + parseInt(dm[3] || '0') * 60 + parseInt(dm[4] || '0')) * 1000;
                            endDate = new Date(startParsed.date.getTime() + ms);
                            endLocalStr = undefined;
                        } else {
                            const ep = parseIcalDateStr(endStr);
                            endDate = ep.date;
                            endLocalStr = ep.localStr;
                        }
                        events.push({
                            start: startParsed.date,
                            end: endDate,
                            summary,
                            ...(startParsed.localStr && { startLocalStr: startParsed.localStr }),
                            ...(endLocalStr && { endLocalStr }),
                        } as any);
                    }
                }
                continue;
            }

            // Extract only the VEVENT block to avoid matching DTSTART/DTEND values
            // inside VTIMEZONE definitions (Yandex includes historical tz data starting 1880-01-01
            // which caused the regex to pick up DTSTART:18800101T000000 instead of the real event).
            const veventMatch = obj.data.match(/BEGIN:VEVENT[\s\S]*?END:VEVENT/);
            if (!veventMatch) continue;
            const eventData = veventMatch[0];

            const dtstartMatch = eventData.match(/DTSTART(?:;.*?)?:(.*)/);
            const dtendMatch = eventData.match(/DTEND(?:;.*?)?:(.*)/);
            const summaryMatch = eventData.match(/SUMMARY:(.*)/);

            if (dtstartMatch) {
                const startParsed = parseIcalDateStr(dtstartMatch[1]);
                let endParsed = dtendMatch ? parseIcalDateStr(dtendMatch[1]) : {
                    date: new Date(startParsed.date.getTime() + 60 * 60 * 1000),
                    localStr: undefined as string | undefined
                };

                // If the event is an all-day event (length 8) and no explicit end was given
                if (dtstartMatch[1].trim().length === 8 && !dtendMatch) {
                    endParsed.date = new Date(startParsed.date.getTime() + 24 * 60 * 60 * 1000);
                    const ny = endParsed.date.getUTCFullYear();
                    const nm = String(endParsed.date.getUTCMonth() + 1).padStart(2, '0');
                    const nd = String(endParsed.date.getUTCDate()).padStart(2, '0');
                    endParsed.localStr = `${ny}-${nm}-${nd}T00:00:00`;
                }

                events.push({
                    start: startParsed.date,
                    end: endParsed.date,
                    summary: summaryMatch ? summaryMatch[1].trim() : 'Busy',
                    ...(startParsed.localStr && { startLocalStr: startParsed.localStr }),
                    ...(endParsed.localStr && { endLocalStr: endParsed.localStr }),
                } as any);
            }
        }

        return { success: true, events };
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Ошибка запроса Yandex Calendar';
        return { success: false, error: message };
    }
}
