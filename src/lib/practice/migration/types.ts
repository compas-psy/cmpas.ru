// Task 10 (founder review correction, 2026-09-03): the canonical event
// shape Tasks 11/12/13 (import preview/classification, atomic commit,
// CSV/XLSX fallback) consume. Both calendar fetchers
// (src/lib/calendar/google.ts, yandex.ts) build this directly — no
// consumer should ever need to re-derive integration/series identity from
// a lower-level shape. src/lib/calendar/normalized-event.ts's
// NormalizedCalendarEvent is a plain alias for this type, kept for that
// module's own internal naming.

export type CalendarProvider = 'google' | 'yandex';

export interface PracticeSourceEvent {
    provider: CalendarProvider;
    integrationId: string;

    /**
     * Identity of THIS specific occurrence. Task 12's dedupe/idempotency
     * key is UNIQUE(integrationId, externalEventId) — never a hash of
     * summary/time, which can collide or change.
     */
    externalEventId: string;
    /**
     * Identity of the recurring series this occurrence belongs to, or null
     * for a non-recurring event. Two occurrences of the same series share
     * this value but have DIFFERENT externalEventId — see
     * src/lib/calendar/google.ts / yandex.ts for how each provider derives
     * both ids.
     */
    externalSeriesId: string | null;

    start: Date;
    end: Date;
    summary: string;
    allDay: boolean;

    // Derived, display-friendly wall-clock fields (resolved against the
    // practice's configured timezone — see resolveWallClockParts in
    // src/lib/calendar/normalized-event.ts). For an allDay event these are
    // literal calendar-date strings, never timezone-converted (an all-day
    // event has no time-of-day or timezone semantics at all).
    date: string; // "YYYY-MM-DD"
    startTime: string; // "HH:MM"
    endTime: string; // "HH:MM"

    /** True when this event is one PRAKTIKA itself created and pushed out (loop-back). */
    isOwnSession: boolean;
    /** The DiarySession id this event mirrors, when isOwnSession is true. */
    ownSessionId: string | null;
}
