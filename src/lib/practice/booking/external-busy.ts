import { db } from '@/lib/db';
import { fetchGoogleCalendarEvents } from '@/lib/calendar/google';
import { fetchYandexCalendarEvents } from '@/lib/calendar/yandex';
import type { BlockInput } from './types';

// Shared external-calendar-busy fetcher — previously duplicated almost
// verbatim inside getAvailableDates and getAvailableTimes (src/app/bot/
// actions.ts). Task 7 (founder review): booking-commit revalidation must
// also see these blocks, not just DiaryBlock rows, so this is now the one
// place that knows how to turn a psychologist's connected Google/Yandex
// calendars into resolver-shaped busy blocks.
//
// Deliberately NOT called from inside a db transaction / advisory lock —
// this does real network I/O, which must never happen while holding a lock.
// Callers fetch this BEFORE opening a transaction and pass the result in.

function getPartsInTz(date: Date, timeZone: string) {
    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone,
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', hour12: false,
    });
    const parts = formatter.formatToParts(date);
    const get = (type: string) => parts.find(p => p.type === type)?.value || '00';
    let hour = get('hour');
    if (hour === '24') hour = '00';
    return {
        year: Number(get('year')),
        month: Number(get('month')),
        day: Number(get('day')),
        hour,
        minute: get('minute'),
    };
}

export async function fetchExternalBusyBlocks(
    psychologistId: string,
    rangeStart: Date,
    rangeEnd: Date,
    options: { timezone?: string | null; blockConflicts?: boolean } = {},
): Promise<BlockInput[]> {
    if (options.blockConflicts === false) return [];

    const integrations = await db.calendarIntegration.findMany({
        where: { psychologistId, isActive: true, syncFrom: true },
    });
    if (!integrations.length) return [];

    const tz = options.timezone || 'Europe/Moscow';
    const blocks: BlockInput[] = [];

    for (const integration of integrations) {
        let res;
        if (integration.provider === 'google') {
            res = await fetchGoogleCalendarEvents(integration.id, rangeStart, rangeEnd);
        } else if (integration.provider === 'yandex') {
            res = await fetchYandexCalendarEvents(integration.id, rangeStart, rangeEnd);
        }

        if (res && res.success && res.events) {
            for (const ev of res.events as any[]) {
                // Yandex iCal events without 'Z' suffix are "floating" local time —
                // they come back with a startLocalStr/endLocalStr to avoid UTC mis-conversion.
                const getParts = (dateInput: Date, localStr?: string) => {
                    if (localStr) {
                        const [d, t] = localStr.split('T');
                        const [y, m, day] = d.split('-');
                        const [h, min] = t.split(':');
                        return { year: Number(y), month: Number(m), day: Number(day), hour: h, minute: min };
                    }
                    return getPartsInTz(dateInput, tz);
                };

                const localStart = new Date(ev.start);
                const localEnd = new Date(ev.end);
                const startParts = getParts(localStart, ev.startLocalStr);
                const endParts = getParts(localEnd, ev.endLocalStr);

                const date = new Date(Date.UTC(startParts.year, startParts.month - 1, startParts.day));
                const startTime = `${startParts.hour}:${startParts.minute}`;
                const endTime = `${endParts.hour}:${endParts.minute}`;

                blocks.push({ date, startTime, endTime });
            }
        }
    }

    return blocks;
}
