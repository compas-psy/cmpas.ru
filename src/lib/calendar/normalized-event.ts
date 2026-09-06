// Task 10 (PRAKTIKA MVP, founder review correction): one shared shape for a
// calendar event, regardless of provider. Before this, fetchGoogleCalendarEvents
// and fetchYandexCalendarEvents shared an identical TYPE ANNOTATION
// (`{ start, end, summary }`) but not an identical VALUE shape — Yandex
// smuggled extra untyped fields (`startLocalStr`/`endLocalStr`) through an
// `as any` cast, and neither exposed a stable external identity, recurring-
// series identity, an all-day flag, or "is this actually one of our own
// synced sessions looping back." Every consumer (the availability
// resolver's external-busy blocks, the calendar-import preview) had to know
// both providers' undocumented quirks itself.
//
// The canonical shape is PracticeSourceEvent (src/lib/practice/migration/
// types.ts) — Tasks 11/12/13's contract. NormalizedCalendarEvent is a plain
// alias kept for this module's own naming; nothing here adds fields PracticeSourceEvent
// doesn't already have.
//
// Concrete bugs this file's helper (and the fetchers that use it) fix, not
// just a type-tidying exercise:
//   1. src/app/api/diary/calendar/import/preview/route.ts computed
//      date/time with `date.getHours()`/`getMinutes()` — the SERVER's OS
//      timezone, not the practice's configured one. A practice on
//      Europe/Moscow with a server running in UTC saw every imported
//      event's time off by the UTC offset.
//   2. fetchYandexCalendarEvents never read back the iCal UID, so it had no
//      way to recognize a Yandex event PRAKTIKA itself created and pushed
//      (see pushSessionToYandex's `compas-session-{id}@cmpas.ru` UID) —
//      unlike Google, which already excludes its own synced events via
//      extendedProperties. A psychologist's own already-booked session (or,
//      worse, a stale event left behind by a reschedule — Yandex delete is
//      still a no-op, see src/lib/calendar/auto-sync.ts) counted as
//      "external busy" against their own future availability, forever.

import type { PracticeSourceEvent } from '@/lib/practice/migration/types';

export type { CalendarProvider } from '@/lib/practice/migration/types';
export type NormalizedCalendarEvent = PracticeSourceEvent;

/** Helper: robust date parsing to a specific timezone without relying on the server's local time. */
function getPartsInTz(date: Date, timeZone: string) {
    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone,
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', hour12: false,
    });
    const parts = formatter.formatToParts(date);
    const get = (type: string) => parts.find((p) => p.type === type)?.value || '00';

    // Some runtimes return "24" instead of "00" for midnight with hour12: false.
    let hour = get('hour');
    if (hour === '24') hour = '00';

    return { year: get('year'), month: get('month'), day: get('day'), hour, minute: get('minute') };
}

/**
 * Resolves the wall-clock date/time an absolute instant represents.
 *
 * `localStr` (an ISO-like "YYYY-MM-DDTHH:MM:SS" with no timezone) is for
 * Yandex's "floating time" events — an iCal DTSTART/DTEND with no `Z`
 * suffix and no explicit VTIMEZONE offset means "this literal wall-clock
 * time, in whatever zone the viewer is in": the practice's zone, by
 * definition, since it's the psychologist's own calendar. Converting a
 * floating time via `timezone` would be actively wrong — there is no UTC
 * instant to convert FROM, only the literal digits already written. When
 * `localStr` is given, its digits are used verbatim; `timezone` is only
 * used for an unambiguous (already-UTC-anchored) instant.
 *
 * NEVER call this for an all-day event — an all-day date has no time-of-day
 * or timezone meaning at all (Google's `start.date`/`end.date`, Yandex's
 * 8-digit DTSTART), and running it through Intl timezone conversion can
 * shift the calendar date itself for a timezone west of UTC. Both fetchers
 * use the literal date string directly for all-day events instead.
 */
export function resolveWallClockParts(instant: Date, timezone: string, localStr?: string): { date: string; time: string } {
    if (localStr) {
        const [d, t] = localStr.split('T');
        return { date: d, time: t.slice(0, 5) };
    }
    const parts = getPartsInTz(instant, timezone);
    return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` };
}
