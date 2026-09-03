// Yandex Calendar CalDAV service (via tsdav)

import { DAVClient } from 'tsdav';
import { db } from '@/lib/db';
import { resolveWallClockParts, type NormalizedCalendarEvent } from './normalized-event';

// Yandex CalDAV server URL
const YANDEX_CALDAV_URL = 'https://caldav.yandex.ru';

// Task 10: the UID PRAKTIKA stamps on every event it pushes to Yandex — the
// exact analogue of Google's extendedProperties.private.compasSessionId.
// Reading it back (fetchYandexCalendarEvents below) is what makes loop-back
// detection possible for Yandex at all: before this, a psychologist's own
// already-booked session (or a stale event a reschedule left behind — see
// the note on Yandex delete being a no-op, in src/lib/calendar/auto-sync.ts)
// counted as "external busy" against their own future availability forever,
// since nothing recognized it as one of ours.
const OWN_SESSION_UID_RE = /^compas-session-(.+)@cmpas\.ru$/;

function yandexOwnSessionUid(sessionId: string): string {
    return `compas-session-${sessionId}@cmpas.ru`;
}

function parseYandexOwnSessionId(uid: string | undefined): string | null {
    if (!uid) return null;
    const match = uid.trim().match(OWN_SESSION_UID_RE);
    return match ? match[1] : null;
}

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
        `UID:${yandexOwnSessionUid(session.id)}`,
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
    endDate: Date,
    options?: { includeCompasEvents?: boolean; timezone?: string }
): Promise<{ success: boolean; events?: NormalizedCalendarEvent[]; error?: string }> {
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

        const timezone = options?.timezone || 'Europe/Moscow';
        const rawEvents: NormalizedCalendarEvent[] = [];

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
                        // A VFREEBUSY period has no per-interval UID of its own
                        // (it's an aggregate busy/free report, not a discrete
                        // event) — synthesize a stable-per-fetch identity from
                        // the interval itself, and never treat it as one of our
                        // own sessions (that needs a real UID to detect).
                        const startWc = resolveWallClockParts(startParsed.date, timezone, startParsed.localStr);
                        const endWc = resolveWallClockParts(endDate, timezone, endLocalStr);
                        rawEvents.push({
                            provider: 'yandex',
                            externalId: `vfb:${startParsed.date.toISOString()}:${endDate.toISOString()}`,
                            summary,
                            start: startParsed.date,
                            end: endDate,
                            date: startWc.date,
                            startTime: startWc.time,
                            endTime: endWc.time,
                            isAllDay: false,
                            isOwnSession: false,
                            ownSessionId: null,
                        });
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
            const uidMatch = eventData.match(/UID:(.*)/);

            if (dtstartMatch) {
                const startParsed = parseIcalDateStr(dtstartMatch[1]);
                let endParsed = dtendMatch ? parseIcalDateStr(dtendMatch[1]) : {
                    date: new Date(startParsed.date.getTime() + 60 * 60 * 1000),
                    localStr: undefined as string | undefined
                };
                const isAllDay = dtstartMatch[1].trim().length === 8;

                // If the event is an all-day event (length 8) and no explicit end was given
                if (isAllDay && !dtendMatch) {
                    endParsed.date = new Date(startParsed.date.getTime() + 24 * 60 * 60 * 1000);
                    const ny = endParsed.date.getUTCFullYear();
                    const nm = String(endParsed.date.getUTCMonth() + 1).padStart(2, '0');
                    const nd = String(endParsed.date.getUTCDate()).padStart(2, '0');
                    endParsed.localStr = `${ny}-${nm}-${nd}T00:00:00`;
                }

                const uid = uidMatch ? uidMatch[1].trim() : undefined;
                const ownSessionId = parseYandexOwnSessionId(uid);
                const startWc = resolveWallClockParts(startParsed.date, timezone, startParsed.localStr);
                const endWc = resolveWallClockParts(endParsed.date, timezone, endParsed.localStr);

                rawEvents.push({
                    provider: 'yandex',
                    // Fall back to a synthesized id only if this particular
                    // VEVENT genuinely lacks a UID (non-conformant producer) —
                    // Yandex itself always writes one.
                    externalId: uid || `vevent:${startParsed.date.toISOString()}:${summaryMatch?.[1]?.trim() || ''}`,
                    summary: summaryMatch ? summaryMatch[1].trim() : 'Busy',
                    start: startParsed.date,
                    end: endParsed.date,
                    date: startWc.date,
                    startTime: startWc.time,
                    endTime: endWc.time,
                    isAllDay,
                    isOwnSession: Boolean(ownSessionId),
                    ownSessionId,
                });
            }
        }

        // Same rule as Google (see fetchGoogleCalendarEvents): importing/
        // scanning for clients wants to SEE our own synced events (they carry
        // client names); checking for conflicts/busy times must exclude
        // them, since a session's own mirrored external event must never
        // count as busy against itself.
        const events = rawEvents.filter((event) => options?.includeCompasEvents || !event.isOwnSession);

        return { success: true, events };
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Ошибка запроса Yandex Calendar';
        return { success: false, error: message };
    }
}
