import { db } from '@/lib/db';
import { fetchGoogleCalendarEvents } from '@/lib/calendar/google';
import { fetchYandexCalendarEvents } from '@/lib/calendar/yandex';
import { normalizedEventToBusyBlocks } from '@/lib/practice/migration/busy-blocks';
import type { BlockInput } from './types';

// Shared external-calendar-busy fetcher — previously duplicated almost
// verbatim inside getAvailableDates and getAvailableTimes (src/app/bot/
// actions.ts). Task 7 (founder review): booking-commit revalidation must
// also see these blocks, not just DiaryBlock rows, so this is now the one
// place that knows how to turn a psychologist's connected Google/Yandex
// calendars into resolver-shaped busy blocks.
//
// Task 10: date/startTime/endTime are resolved once, inside the fetchers
// themselves (src/lib/calendar/normalized-event.ts), against the
// practice's configured timezone — including Yandex's "floating time"
// events correctly. normalizedEventToBusyBlocks (src/lib/practice/
// migration/busy-blocks.ts) then expands each event into the actual set of
// per-day blocks the resolver needs: an all-day event becomes one 00:00-24:00
// block PER day it spans (so it still blocks availability with
// blockConflicts=true, even though it's never imported as a client
// session), and a timed event crossing midnight splits into two blocks
// instead of one nonsensical "23:00-01:00" interval.
//
// Deliberately NOT called from inside a db transaction / advisory lock —
// this does real network I/O, which must never happen while holding a lock.
// Callers fetch this BEFORE opening a transaction and pass the result in.

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

    const timezone = options.timezone || 'Europe/Moscow';
    const blocks: BlockInput[] = [];

    for (const integration of integrations) {
        let res;
        if (integration.provider === 'google') {
            res = await fetchGoogleCalendarEvents(integration.id, rangeStart, rangeEnd, { timezone });
        } else if (integration.provider === 'yandex') {
            res = await fetchYandexCalendarEvents(integration.id, rangeStart, rangeEnd, { timezone });
        }

        if (res && res.success && res.events) {
            for (const ev of res.events) {
                blocks.push(...normalizedEventToBusyBlocks(ev));
            }
        }
    }

    return blocks;
}
