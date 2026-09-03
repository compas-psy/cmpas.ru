'use server';

import { db } from '@/lib/db';

// Task 8 (founder review, 2026-09-03) — KNOWN GAP, deliberately not closed
// here:
//
// Every caller that reschedules a session (createSelfPracticeBooking's
// reschedule counterpart in src/lib/practice/booking/booking.ts, and its
// call sites in src/app/diary/actions/sessions.ts and
// src/app/client/reschedule/[sessionId]/actions.ts) does
// autoDeleteSessionFromCalendars() followed by autoSyncSessionToCalendars()
// — delete the old external event, create a new one. For a session that was
// itself IMPORTED from an external calendar this is wrong: it should update
// the linked provider event in place, not delete/recreate a duplicate.
//
// Task 12 introduced CalendarSessionLink (prisma/schema.prisma) — the model
// that remembers which external event a given DiarySession maps to — and
// populates it from every import commit (src/lib/practice/migration/
// commit.ts) and read from it for external-busy (src/lib/practice/booking/
// external-busy.ts, so a session's own linked event never blocks itself).
// Wiring THIS file's reschedule path to use it (update-in-place instead of
// delete+recreate) is intentionally NOT part of Task 12 — it touches live
// booking/reschedule flows, a separate change from "atomic/idempotent
// import commit". Remaining acceptance criteria for that follow-up:
//   - reschedule updates the LINKED external event in place;
//   - it must never delete+recreate a duplicate for a linked session;
//   - Yandex needs real delete support first (see the comment in
//     autoDeleteSessionFromCalendars below — it doesn't delete anything
//     today), otherwise a linked Yandex event ends up duplicated, not moved;
//   - an imported event must not turn into two events after a reschedule.
//
// Until that follow-up lands, an imported/synced session that gets
// rescheduled will duplicate its external event — a known, accepted gap.

/**
 * Auto-sync a session to all connected and active calendars.
 * Called after session create/update. Checks autoSync setting.
 */
export async function autoSyncSessionToCalendars(
    psychologistId: string,
    session: {
        id: string;
        date: Date;
        time: string;
        endTime: string | null;
        duration: number;
        type: string;
        format: string;
        notes: string | null;
        client?: { name: string } | null;
    }
) {
    try {
        // Check if autoSync is enabled
        const settings = await db.psychologistSettings.findUnique({
            where: { psychologistId },
            select: { autoSync: true },
        });

        if (!settings?.autoSync) return;

        // Get active integrations
        const integrations = await db.calendarIntegration.findMany({
            where: { psychologistId, isActive: true },
        });

        for (const integration of integrations) {
            try {
                if (integration.provider === 'google' && integration.accessToken) {
                    const { createGoogleCalendarEvent } = await import('@/lib/calendar/google');
                    await createGoogleCalendarEvent(integration.id, session);
                } else if (integration.provider === 'yandex' && integration.caldavLogin) {
                    const { pushSessionToYandex } = await import('@/lib/calendar/yandex');
                    await pushSessionToYandex(integration.id, session);
                }
            } catch (e) {
                console.error(`Auto-sync failed for ${integration.provider}:`, e);
            }
        }
    } catch (e) {
        console.error('autoSyncSessionToCalendars error:', e);
    }
}

/**
 * Auto-delete a session from all connected calendars.
 * Called after session delete/cancel.
 */
export async function autoDeleteSessionFromCalendars(
    psychologistId: string,
    sessionId: string
) {
    try {
        const settings = await db.psychologistSettings.findUnique({
            where: { psychologistId },
            select: { autoSync: true },
        });

        if (!settings?.autoSync) return;

        const integrations = await db.calendarIntegration.findMany({
            where: { psychologistId, isActive: true },
        });

        for (const integration of integrations) {
            try {
                if (integration.provider === 'google' && integration.accessToken) {
                    const { deleteGoogleCalendarEvent } = await import('@/lib/calendar/google');
                    await deleteGoogleCalendarEvent(integration.id, sessionId);
                }
                // For Yandex CalDAV, deleting individual events requires finding the object URL
                // which we don't store — would need additional logic or skip for now
            } catch (e) {
                console.error(`Auto-delete from ${integration.provider} failed:`, e);
            }
        }
    } catch (e) {
        console.error('autoDeleteSessionFromCalendars error:', e);
    }
}
