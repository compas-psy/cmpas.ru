// CJM_booking_v1.md §1.3 "тихая запись": the client can add their session to
// their own personal calendar with a title they choose, defaulting to a
// neutral one — unlike the specialist's Google Calendar sync
// (src/lib/calendar/google.ts), which is a separate integration and always
// writes "{тип} сессия — {имя клиента}". This module never touches that.

export const DEFAULT_SESSION_TITLE = 'Личная встреча';
const MAX_TITLE_LENGTH = 100;

export function sanitizeSessionTitle(input?: string | null): string {
    if (!input) return DEFAULT_SESSION_TITLE;
    const collapsed = input.replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();
    if (!collapsed) return DEFAULT_SESSION_TITLE;
    return collapsed.slice(0, MAX_TITLE_LENGTH);
}

function escapeIcsText(text: string): string {
    return text
        .replace(/\\/g, '\\\\')
        .replace(/;/g, '\\;')
        .replace(/,/g, '\\,');
}

type SessionTimeLike = {
    date: Date | string;
    time: string;
    duration?: number | null;
    endTime?: string | null;
};

// Same technique as toDateStr()/google.ts's dateStr: read the date part out
// of the ISO string instead of local Date math, so this doesn't depend on
// the server process's timezone.
function sessionDatePart(date: Date | string): string {
    const iso = date instanceof Date ? date.toISOString() : String(date);
    return iso.slice(0, 10).replace(/-/g, '');
}

// Mirrors google.ts's fallback end-time computation (pure HH:MM integer
// math, no Date object) rather than session-start Date arithmetic, which is
// ambiguous about which timezone "10:00" is meant in.
function computeEndTime(time: string, duration: number | null | undefined, endTime?: string | null): string {
    if (endTime) return endTime;
    const [h, m] = time.split(':').map(Number);
    const endMinutes = h * 60 + m + (duration ?? 50);
    return `${String(Math.floor(endMinutes / 60)).padStart(2, '0')}:${String(endMinutes % 60).padStart(2, '0')}`;
}

function icsTime(time: string): string {
    return `${time.replace(':', '')}00`;
}

export function buildSessionIcs(session: SessionTimeLike, opts: { title?: string | null; uid: string; now?: Date }): string {
    const title = sanitizeSessionTitle(opts.title);
    const datePart = sessionDatePart(session.date);
    const endTimeStr = computeEndTime(session.time, session.duration, session.endTime);
    const dtStart = `${datePart}T${icsTime(session.time)}`;
    const dtEnd = `${datePart}T${icsTime(endTimeStr)}`;
    const dtStamp = `${(opts.now ?? new Date()).toISOString().replace(/[-:]/g, '').split('.')[0]}Z`;

    const lines = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//КОМПАС//Booking//RU',
        'CALSCALE:GREGORIAN',
        'BEGIN:VEVENT',
        `UID:${opts.uid}`,
        `DTSTAMP:${dtStamp}`,
        // TZID without a VTIMEZONE block: Google/Apple/Outlook all resolve
        // known IANA zone names on their own; a full VTIMEZONE definition is
        // more ceremony than a hand-rolled single-event .ics needs here.
        `DTSTART;TZID=Europe/Moscow:${dtStart}`,
        `DTEND;TZID=Europe/Moscow:${dtEnd}`,
        `SUMMARY:${escapeIcsText(title)}`,
        'END:VEVENT',
        'END:VCALENDAR',
    ];
    return `${lines.join('\r\n')}\r\n`;
}
