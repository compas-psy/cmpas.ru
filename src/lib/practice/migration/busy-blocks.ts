import type { PracticeSourceEvent } from './types';
import type { BlockInput } from '@/lib/practice/booking/types';

// Task 10 (founder review correction): a PracticeSourceEvent is not always
// one bookable-availability BlockInput. Two cases the naive one-line
// mapping got wrong:
//
// 1. All-day events. They're never imported as a client session by
//    default (Task 11's classification job), but with blockConflicts=true
//    they must still block availability for every day they cover — a
//    multi-day all-day event ("отпуск", 3 days) needs one full-day block
//    PER day, not a single block spanning multiple calendar dates (the
//    resolver in src/lib/practice/booking/availability.ts only ever
//    compares a block against one day at a time).
//
// 2. A timed event crossing midnight (e.g. 23:00 → 01:00 the next day).
//    `date`/`startTime`/`endTime` on PracticeSourceEvent are already
//    correctly resolved wall-clock values — the END's clock time is right,
//    it's just recorded against the START's calendar date. Left as one
//    block, "23:00–01:00" reads as a negative-duration interval and the
//    resolver's `currentTotalMins < blockEndMins` check would silently
//    never match anything after midnight. Split into "23:00–24:00" on the
//    start date and "00:00–01:00" on the next date instead.

function toMinutes(hhmm: string): number {
    const [h, m] = hhmm.split(':').map(Number);
    return h * 60 + m;
}

function addDaysUtc(date: Date, days: number): Date {
    return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function nextDateStr(dateStr: string): string {
    const [y, m, d] = dateStr.split('-').map(Number);
    const next = addDaysUtc(new Date(Date.UTC(y, m - 1, d)), 1);
    return next.toISOString().slice(0, 10);
}

function dateStrToUtcDate(dateStr: string): Date {
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d));
}

export function normalizedEventToBusyBlocks(event: PracticeSourceEvent): BlockInput[] {
    if (event.allDay) {
        // event.start/event.end are literal UTC-midnight-anchored calendar
        // dates (see google.ts/yandex.ts — never Intl-timezone-converted
        // for an all-day event, which has no time-of-day/timezone meaning
        // at all). end is the EXCLUSIVE boundary, matching how both
        // providers report all-day event end dates.
        const blocks: BlockInput[] = [];
        let cursor = new Date(Date.UTC(event.start.getUTCFullYear(), event.start.getUTCMonth(), event.start.getUTCDate()));
        const endBoundary = new Date(Date.UTC(event.end.getUTCFullYear(), event.end.getUTCMonth(), event.end.getUTCDate()));
        // A malformed/zero-length all-day event (end <= start) still blocks
        // its one start day — never silently produce zero blocks for a
        // real calendar entry.
        if (endBoundary <= cursor) {
            return [{ date: cursor, startTime: '00:00', endTime: '24:00' }];
        }
        while (cursor < endBoundary) {
            blocks.push({ date: new Date(cursor), startTime: '00:00', endTime: '24:00' });
            cursor = addDaysUtc(cursor, 1);
        }
        return blocks;
    }

    const startMins = toMinutes(event.startTime);
    const endMins = toMinutes(event.endTime);

    if (endMins > startMins) {
        return [{ date: dateStrToUtcDate(event.date), startTime: event.startTime, endTime: event.endTime }];
    }

    // Wrapped past midnight at least once. PracticeSourceEvent doesn't
    // carry the end's calendar date (only its time-of-day), so a span of
    // more than one extra day can't be reconstructed from these fields
    // alone — genuinely multi-day TIMED events (as opposed to all-day) are
    // vanishingly rare in real calendars, so this covers exactly the
    // single-midnight-crossing case the resolver actually needs to handle.
    return [
        { date: dateStrToUtcDate(event.date), startTime: event.startTime, endTime: '24:00' },
        { date: dateStrToUtcDate(nextDateStr(event.date)), startTime: '00:00', endTime: event.endTime },
    ];
}
