// Task 11 (founder review of Task 10, item 5): the legacy
// src/app/api/diary/calendar/import/preview/route.ts defaults to a 60-day
// window. The final MVP range is "psychologist-local today -> +180 days" —
// this is the one place that computes it, so Task 11's new import flow
// never has to redefine it (and never inherits the old 60-day default).
//
// "Today" is resolved in the PRACTICE's configured timezone, not the
// server's OS timezone — the same class of bug Task 10 fixed for event
// date/time resolution (src/lib/calendar/normalized-event.ts). Using
// `new Date()` + `setHours(0,0,0,0)` (the old route's approach) reads and
// writes in the server's local time, which silently shifts "today" by a
// day for a server not running in the practice's zone.

export interface PracticeImportRange {
    start: Date;
    end: Date;
}

const IMPORT_RANGE_DAYS = 180;

export function practiceImportRange(timezone: string, now: Date = new Date()): PracticeImportRange {
    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        year: 'numeric', month: '2-digit', day: '2-digit',
    });
    const parts = formatter.formatToParts(now);
    const get = (type: string) => parts.find((p) => p.type === type)?.value;
    const year = Number(get('year'));
    const month = Number(get('month'));
    const day = Number(get('day'));

    // Calendar-date boundaries, UTC-anchored — the same convention
    // DiarySession.date and every other "which day" field in this codebase
    // already uses (see e.g. src/lib/practice/booking/booking.ts's
    // dayWindowFor), not a real timezone-aware instant.
    const start = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
    const end = new Date(Date.UTC(year, month - 1, day + IMPORT_RANGE_DAYS, 23, 59, 59, 999));
    return { start, end };
}
