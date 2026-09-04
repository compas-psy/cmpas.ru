// Task 12 (founder correction): commit.ts used to build calendar-day
// boundaries with `new Date(dateStr); d.setHours(0,0,0,0)` — `new
// Date('YYYY-MM-DD')` parses as UTC midnight, but `.setHours()` reads/writes
// through the SERVER's OS timezone, not UTC. On a server not running in UTC
// this can silently shift which calendar day gets persisted. Every date/time
// boundary the import commit path touches must go through these helpers
// instead — never a bare `new Date(...)` + local-time mutation.
//
// Convention (same one DiarySession.date and practiceImportRange already
// use): a "calendar date" is encoded as a UTC-midnight-anchored Date; wall
// time is separate minutes-past-midnight, also UTC-encoded. This is NOT a
// real timezone-aware instant — it's a deterministic encoding of "which day
// and time the psychologist reviewed," decided once upstream (Task 10's
// fetchers, resolved against the practice's configured timezone) and never
// re-interpreted through the server's local clock afterward.

export function calendarDateTimeToUtc(dateStr: string, timeStr: string): Date {
    const [y, m, d] = dateStr.split('-').map(Number);
    const [hh, mm] = timeStr.split(':').map(Number);
    return new Date(Date.UTC(y, m - 1, d, hh, mm, 0, 0));
}

export function calendarDateToUtcMidnight(dateStr: string): Date {
    return calendarDateTimeToUtc(dateStr, '00:00');
}

export function utcDatePart(date: Date): string {
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
}

export function utcTimePart(date: Date): string {
    return `${String(date.getUTCHours()).padStart(2, '0')}:${String(date.getUTCMinutes()).padStart(2, '0')}`;
}

/** Start (00:00:00.000) and end (23:59:59.999) of the UTC calendar day a given instant's UTC date-part falls on. */
export function utcDayBounds(date: Date): { start: Date; end: Date } {
    const y = date.getUTCFullYear();
    const m = date.getUTCMonth();
    const d = date.getUTCDate();
    return {
        start: new Date(Date.UTC(y, m, d, 0, 0, 0, 0)),
        end: new Date(Date.UTC(y, m, d, 23, 59, 59, 999)),
    };
}
