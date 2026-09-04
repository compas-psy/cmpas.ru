// Task 13: deterministic, non-guessing normalization of the per-row values
// that come out of a CSV/XLSX/paste cell — dates, times, duration, format.
// Never resolve an ambiguous value (e.g. "03/04/26") — an ambiguous or
// unrecognized value is always an error, never a guess (spec §6).

export type CellRaw = string | number | Date | null | undefined;

function isValidCalendarDate(y: number, m: number, d: number): boolean {
    if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) return false;
    if (m < 1 || m > 12 || d < 1 || d > 31) return false;
    const date = new Date(Date.UTC(y, m - 1, d));
    return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

export type DateParseResult = { ok: true; date: string } | { ok: false; errorCode: 'INVALID_DATE_OR_TIME' };

/** Returns a canonical "YYYY-MM-DD" string, or a rejection — never a guess. */
export function parseCellDate(value: CellRaw): DateParseResult {
    if (value instanceof Date) {
        if (Number.isNaN(value.getTime())) return { ok: false, errorCode: 'INVALID_DATE_OR_TIME' };
        const y = value.getUTCFullYear();
        const m = value.getUTCMonth() + 1;
        const d = value.getUTCDate();
        return { ok: true, date: `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}` };
    }
    const str = typeof value === 'number' ? String(value) : (value ?? '').toString().trim();
    if (!str) return { ok: false, errorCode: 'INVALID_DATE_OR_TIME' };

    const isoMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (isoMatch) {
        const [, y, m, d] = isoMatch.map(Number) as unknown as [number, number, number, number];
        if (!isValidCalendarDate(y, m, d)) return { ok: false, errorCode: 'INVALID_DATE_OR_TIME' };
        return { ok: true, date: `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}` };
    }

    const dottedMatch = str.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
    if (dottedMatch) {
        const [, dStr, mStr, yStr] = dottedMatch;
        const d = Number(dStr);
        const m = Number(mStr);
        const y = Number(yStr);
        if (!isValidCalendarDate(y, m, d)) return { ok: false, errorCode: 'INVALID_DATE_OR_TIME' };
        return { ok: true, date: `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}` };
    }

    // Anything else — including genuinely ambiguous shapes like "03/04/26" —
    // is never guessed at. Reject.
    return { ok: false, errorCode: 'INVALID_DATE_OR_TIME' };
}

export type TimeParseResult = { ok: true; time: string } | { ok: false; errorCode: 'INVALID_DATE_OR_TIME' };

export function parseCellTime(value: CellRaw): TimeParseResult {
    if (value instanceof Date) {
        if (Number.isNaN(value.getTime())) return { ok: false, errorCode: 'INVALID_DATE_OR_TIME' };
        const h = value.getUTCHours();
        const m = value.getUTCMinutes();
        return { ok: true, time: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}` };
    }
    const str = (value ?? '').toString().trim();
    const match = str.match(/^(\d{2}):(\d{2})$/);
    if (!match) return { ok: false, errorCode: 'INVALID_DATE_OR_TIME' };
    const h = Number(match[1]);
    const m = Number(match[2]);
    if (h < 0 || h > 23 || m < 0 || m > 59) return { ok: false, errorCode: 'INVALID_DATE_OR_TIME' };
    return { ok: true, time: `${match[1]}:${match[2]}` };
}

function timeToMinutes(time: string): number {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
}

export type DurationResult = { ok: true; duration: number } | { ok: false; errorCode: 'INVALID_DURATION' };

/** Section 7: duration comes from an explicit value, else start/end, else the psychologist's default, else 50. Explicit conflicts between duration and end_time are never silently resolved one way. */
export function resolveDuration(input: {
    durationRaw: CellRaw;
    startTime: string | null;
    endTimeRaw: CellRaw;
    defaultDuration: number;
}): DurationResult {
    const durationNum = input.durationRaw === null || input.durationRaw === undefined || input.durationRaw === ''
        ? null
        : Number(input.durationRaw);
    const hasDuration = durationNum !== null && Number.isFinite(durationNum);
    if (hasDuration && durationNum! <= 0) return { ok: false, errorCode: 'INVALID_DURATION' };

    const endTimeParsed = input.endTimeRaw === null || input.endTimeRaw === undefined || input.endTimeRaw === ''
        ? null
        : parseCellTime(input.endTimeRaw);
    const hasEndTime = !!endTimeParsed && endTimeParsed.ok;

    let computedFromEnd: number | null = null;
    if (hasEndTime && input.startTime) {
        const diff = timeToMinutes((endTimeParsed as { ok: true; time: string }).time) - timeToMinutes(input.startTime);
        computedFromEnd = diff > 0 ? diff : null;
        if (computedFromEnd === null) return { ok: false, errorCode: 'INVALID_DURATION' };
    }

    if (hasDuration && computedFromEnd !== null) {
        // Both given — must describe the same interval within a small
        // rounding tolerance, never silently pick one over the other.
        if (Math.abs(durationNum! - computedFromEnd) > 1) return { ok: false, errorCode: 'INVALID_DURATION' };
        return { ok: true, duration: Math.round(durationNum!) };
    }
    if (hasDuration) return { ok: true, duration: Math.round(durationNum!) };
    if (computedFromEnd !== null) return { ok: true, duration: computedFromEnd };
    return { ok: true, duration: input.defaultDuration };
}

export type SessionFormat = 'online' | 'offline';

const OFFLINE_VALUES = new Set(['offline', 'офлайн', 'очно', 'in person', 'in-person']);
const ONLINE_VALUES = new Set(['online', 'онлайн', 'remote']);

/** Section 8: unrecognized/missing values default to online, visible/editable in preview — never a review-blocking error by themselves. */
export function normalizeFormat(raw: CellRaw): SessionFormat {
    const v = (raw ?? '').toString().trim().toLowerCase().replace(/ё/g, 'е');
    if (OFFLINE_VALUES.has(v)) return 'offline';
    if (ONLINE_VALUES.has(v)) return 'online';
    return 'online';
}

export function cellToTrimmedString(value: CellRaw): string {
    if (value === null || value === undefined) return '';
    if (value instanceof Date) return value.toISOString();
    return String(value).trim();
}
