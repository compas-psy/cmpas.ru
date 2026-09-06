// Task 9 (PRAKTIKA MVP, founder review 2026-09-03): DiarySession.origin —
// see the field's comment in prisma/schema.prisma. Canonical values:
// 'manual' | 'self_booking' | 'calendar_import' | 'spreadsheet_import'.
// 'manual' and 'self_booking' are written by the booking core
// (src/lib/practice/booking/booking.ts's BookingOrigin); 'calendar_import'
// (Google/Yandex, Tasks 10-12) and 'spreadsheet_import' (CSV/XLSX, Task 13)
// are not yet built. Declared here rather than re-exported from booking.ts
// because nothing in the booking core ever produces an import origin, and
// cron modules that only need this one check shouldn't have to pull in
// booking.ts's transaction/lock/slotToken machinery.
//
// origin is PROVENANCE/AUDIT — "where did this row come from" — never a
// communication-policy switch. Do not branch client-notification behavior
// on origin directly; that's clientNotificationsEnabled's job (also on
// DiarySession, see its schema comment). Keeping the two separate means
// re-enabling notifications for an imported session later (a psychologist
// choice) never requires lying about how the session was created.

export type SessionOrigin = 'manual' | 'self_booking' | 'calendar_import' | 'spreadsheet_import';

export const CALENDAR_IMPORT_ORIGIN: SessionOrigin = 'calendar_import';
export const SPREADSHEET_IMPORT_ORIGIN: SessionOrigin = 'spreadsheet_import';

/**
 * Semantic helper for analytics/UI ("does this session come from an
 * import") — NOT for notification gating. Client-facing cron jobs must
 * filter on clientNotificationsEnabled instead (see src/lib/cron/
 * reminders.ts, post-session.ts, post-session-cascade.ts).
 */
export function isImportedSession(session: { origin?: string | null }): boolean {
    return session.origin === CALENDAR_IMPORT_ORIGIN || session.origin === SPREADSHEET_IMPORT_ORIGIN;
}
