// Task 9 (PRAKTIKA MVP): DiarySession.origin — see the field's comment in
// prisma/schema.prisma. 'manual' and 'self_booking' are written by the
// booking core (src/lib/practice/booking/booking.ts's BookingOrigin);
// 'import' will be written by calendar/CSV import (Tasks 10-13, not yet
// built). Declared here rather than re-exported from booking.ts because
// nothing in the booking core ever produces 'import', and cron modules that
// only need this one check shouldn't have to pull in booking.ts's
// transaction/lock/slotToken machinery.

export const IMPORTED_SESSION_ORIGIN = 'import' as const;

/**
 * True for a session the client never went through our booking flow for —
 * pulled in from an external calendar or (later) a CSV import. Automated
 * CLIENT-facing messaging (reminders, post-session mood check, rebooking/
 * weekly-followup nudges) must stay quiet for these: the client may not
 * know ПРАКТИКА exists, never gave a Telegram/MAX chat id through our flow,
 * and a bot message about a session they don't recognize booking would be
 * confusing, not helpful — it would look like the app "somehow already
 * knows" about a private appointment.
 *
 * Psychologist-facing messages (e.g. "tomorrow's session" reminders sent TO
 * the psychologist themselves) are unaffected by this check — they already
 * know about their own import, and that reminder is still useful to them.
 */
export function isImportedSession(session: { origin?: string | null }): boolean {
    return session.origin === IMPORTED_SESSION_ORIGIN;
}
