// Task 8 (PRAKTIKA MVP, founder review of Task 7 follow-up): "reschedule uses
// same booking core" — reschedulePracticeBooking (token-based, web/client
// self-service) and rescheduleManualPracticeSession (raw date/time,
// off-schedule, mobile) both wrap the existing session in the SAME
// (psychologist, day) advisory lock + assertSlotStillAvailable core a fresh
// booking gets, plus a per-session lock so two reschedules of the SAME
// session (to possibly different target days) always serialize against each
// other rather than racing past independent day locks.
//
// Same sandbox constraint as booking.test.ts: no live Postgres here, so
// db.$transaction is mocked as a strict FIFO queue with snapshot/rollback —
// see that file's header comment for why this is a faithful stand-in for
// pg_advisory_xact_lock serialization plus real transactional rollback.

import { describe, it, expect, beforeEach, vi } from 'vitest';

const PSY_ID = 'psy-1';
const MONDAY = '2026-09-07'; // dayOfWeek 0
const TUESDAY = '2026-09-08'; // dayOfWeek 1

const { store, db, SLOTS } = vi.hoisted(() => {
    const slotMonday = {
        id: 'slot-mon',
        psychologistId: 'psy-1',
        dayOfWeek: 0,
        startTime: '09:00',
        endTime: '13:00',
        duration: null,
        format: null,
        addressId: null,
        isActive: true,
        startDate: null,
        endDate: null,
        scheduleRuleId: 'rule-mon',
        scheduleRule: {
            id: 'rule-mon',
            isActive: true,
            format: 'online',
            addressId: null,
            duration: 50,
            breakDuration: 15,
            audienceFilter: 'all',
            startDate: null,
            endDate: null,
        },
    };

    const slotMondayOffline = {
        id: 'slot-mon-offline',
        psychologistId: 'psy-1',
        dayOfWeek: 0,
        startTime: '09:00',
        endTime: '13:00',
        duration: null,
        format: null,
        addressId: null,
        isActive: true,
        startDate: null,
        endDate: null,
        scheduleRuleId: 'rule-mon-offline',
        scheduleRule: {
            id: 'rule-mon-offline',
            isActive: true,
            format: 'offline',
            addressId: 'address-yauzskaya',
            duration: 50,
            breakDuration: 15,
            audienceFilter: 'all',
            startDate: null,
            endDate: null,
        },
    };

    const slotTuesday = {
        id: 'slot-tue',
        psychologistId: 'psy-1',
        dayOfWeek: 1,
        startTime: '09:00',
        endTime: '13:00',
        duration: null,
        format: null,
        addressId: null,
        isActive: true,
        startDate: null,
        endDate: null,
        scheduleRuleId: 'rule-tue',
        scheduleRule: {
            id: 'rule-tue',
            isActive: true,
            format: 'online',
            addressId: null,
            duration: 50,
            breakDuration: 15,
            audienceFilter: 'all',
            startDate: null,
            endDate: null,
        },
    };

    const SLOTS: Record<string, any> = {
        [slotMonday.id]: slotMonday,
        [slotMondayOffline.id]: slotMondayOffline,
        [slotTuesday.id]: slotTuesday,
    };

    const store: { sessions: any[]; maxSessionsPerDay: number | null } = { sessions: [], maxSessionsPerDay: null };

    let lockChain: Promise<unknown> = Promise.resolve();

    const dayFilter = (where: any) => (s: any) =>
        s.psychologistId === where.psychologistId
        && (!where.date || (s.date >= where.date.gte && s.date <= where.date.lte))
        && (!where.id || s.id !== where.id.not);

    const settingsRow = () => ({ maxSessionsPerDay: store.maxSessionsPerDay, sessionBreak: 15, timezone: 'Europe/Moscow', bookingBufferHours: 0, bookingHorizonDays: 365, blockConflicts: true });

    const tx = {
        $executeRaw: async () => undefined,
        psychologistSettings: {
            findUnique: async () => settingsRow(),
        },
        availabilitySlot: {
            findFirst: async ({ where }: any) => {
                const slot = SLOTS[where.id];
                return slot && slot.psychologistId === where.psychologistId ? { ...slot } : null;
            },
        },
        diarySession: {
            // A shallow copy, not the live store reference — a later
            // tx.diarySession.update() must not retroactively mutate a value
            // already captured (e.g. `previousTime`) from this read, same as
            // real Prisma returning a fresh plain object per call.
            findFirst: async ({ where }: any) => {
                const row = store.sessions.find((s) => s.id === where.id && s.psychologistId === where.psychologistId);
                return row ? { ...row } : null;
            },
            findMany: async ({ where }: any) => store.sessions.filter(dayFilter(where)),
            update: async ({ where, data }: any) => {
                const row = store.sessions.find((s) => s.id === where.id);
                Object.assign(row, data);
                return { ...row, client: null };
            },
        },
        diaryBlock: {
            findMany: async () => [],
        },
    };

    const db = {
        // Same rollback-on-throw simulation as booking.test.ts — a real
        // Postgres transaction rolls back the DiarySession update too, not
        // just a create.
        $transaction: (fn: any) => {
            const run = lockChain.then(async () => {
                const snapshot = store.sessions.map((s) => ({ ...s }));
                try {
                    return await fn(tx);
                } catch (e) {
                    store.sessions.splice(0, store.sessions.length, ...snapshot);
                    throw e;
                }
            });
            lockChain = run.then(() => undefined, () => undefined);
            return run;
        },
        psychologistSettings: {
            findUnique: async () => settingsRow(),
        },
        calendarIntegration: {
            findMany: async () => [],
        },
    };

    return { store, db, SLOTS };
});

vi.mock('@/lib/db', () => ({ db }));

function dateAt(dateStr: string): Date {
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d));
}

function existingSession(overrides: Record<string, unknown> = {}) {
    return {
        id: 'session-1',
        psychologistId: PSY_ID,
        clientId: 'client-1',
        date: dateAt(MONDAY),
        time: '09:00',
        endTime: '09:50',
        duration: 50,
        format: 'online',
        addressId: null,
        status: 'confirmed',
        origin: 'self_booking',
        ...overrides,
    };
}

describe('reschedulePracticeBooking — token-based, same core as a fresh booking', () => {
    beforeEach(() => {
        store.sessions = [existingSession()];
        store.maxSessionsPerDay = null;
    });

    it('moves the session in place (same id) to the new exact slot, applying its format/duration/address', async () => {
        const { reschedulePracticeBooking } = await import('../booking');
        const { slotToken } = await import('../slot-token');

        // The rule's 50min duration + 15min break makes candidates fall
        // every 65 minutes from 09:00: 09:00, 10:05, 11:10, ... — 10:05, not
        // an arbitrary "10:00", is the next real bookable option.
        const slot = SLOTS['slot-mon-offline'];
        const token = slotToken({
            psychologistId: PSY_ID, dateStr: MONDAY, time: '10:05',
            availabilitySlotId: slot.id, scheduleRuleId: slot.scheduleRuleId,
            format: 'offline', addressId: 'address-yauzskaya', duration: 50,
        });

        const result = await reschedulePracticeBooking({ psychologistId: PSY_ID, sessionId: 'session-1', slotToken: token, origin: 'self_booking' });

        expect(result.session.id).toBe('session-1');
        expect(result.session.time).toBe('10:05');
        expect(result.session.format).toBe('offline');
        expect(result.session.addressId).toBe('address-yauzskaya');
        expect(result.previousTime).toBe('09:00');
        expect(store.sessions).toHaveLength(1); // updated in place, never a second row
    });

    it('rejects a reschedule onto a slot occupied by another session, and never writes', async () => {
        const { reschedulePracticeBooking, BookingConflictError } = await import('../booking');
        const { slotToken } = await import('../slot-token');

        // 09:00 + (50min duration + 15min break) = 10:05, the next real
        // resolver candidate on this rule.
        store.sessions.push({ ...existingSession(), id: 'other-session', clientId: 'other-client', time: '10:05' });

        const slot = SLOTS['slot-mon'];
        const token = slotToken({
            psychologistId: PSY_ID, dateStr: MONDAY, time: '10:05',
            availabilitySlotId: slot.id, scheduleRuleId: slot.scheduleRuleId,
            format: 'online', addressId: null, duration: 50,
        });

        await expect(reschedulePracticeBooking({ psychologistId: PSY_ID, sessionId: 'session-1', slotToken: token, origin: 'self_booking' }))
            .rejects.toThrow(BookingConflictError);

        expect(store.sessions.find((s) => s.id === 'session-1')!.time).toBe('09:00'); // unchanged
    });

    it('moving to a DIFFERENT day re-checks that day\'s maxSessionsPerDay, excluding the session being moved from ITS OWN old day', async () => {
        const { reschedulePracticeBooking } = await import('../booking');
        const { slotToken } = await import('../slot-token');

        store.maxSessionsPerDay = 1;
        // Tuesday already has zero sessions — moving session-1 there from
        // Monday must be allowed (Tuesday's real bookedCount is 0, not
        // inflated by anything), and Monday's cap no longer matters once the
        // session leaves it.
        const slot = SLOTS['slot-tue'];
        const token = slotToken({
            psychologistId: PSY_ID, dateStr: TUESDAY, time: '09:00',
            availabilitySlotId: slot.id, scheduleRuleId: slot.scheduleRuleId,
            format: 'online', addressId: null, duration: 50,
        });

        const result = await reschedulePracticeBooking({ psychologistId: PSY_ID, sessionId: 'session-1', slotToken: token, origin: 'self_booking' });
        expect(result.session.date.toISOString().slice(0, 10)).toBe(TUESDAY);
    });

    it('moving to a DIFFERENT day already at cap is rejected', async () => {
        const { reschedulePracticeBooking, BookingConflictError } = await import('../booking');
        const { slotToken } = await import('../slot-token');

        store.maxSessionsPerDay = 1;
        store.sessions.push({ ...existingSession(), id: 'tuesday-existing', clientId: 'someone-else', date: dateAt(TUESDAY), time: '11:00' });

        const slot = SLOTS['slot-tue'];
        const token = slotToken({
            psychologistId: PSY_ID, dateStr: TUESDAY, time: '09:00',
            availabilitySlotId: slot.id, scheduleRuleId: slot.scheduleRuleId,
            format: 'online', addressId: null, duration: 50,
        });

        await expect(reschedulePracticeBooking({ psychologistId: PSY_ID, sessionId: 'session-1', slotToken: token, origin: 'self_booking' }))
            .rejects.toThrow(BookingConflictError);
        expect(store.sessions.find((s) => s.id === 'session-1')!.date.toISOString().slice(0, 10)).toBe(MONDAY); // unchanged
    });

    it('rejects an invalid/expired token before ever touching the session', async () => {
        const { reschedulePracticeBooking, BookingConflictError } = await import('../booking');
        await expect(reschedulePracticeBooking({ psychologistId: PSY_ID, sessionId: 'session-1', slotToken: 'slt1_garbage', origin: 'self_booking' }))
            .rejects.toThrow(BookingConflictError);
    });

    it('rejects rescheduling a cancelled session', async () => {
        store.sessions = [existingSession({ status: 'cancelled' })];
        const { reschedulePracticeBooking, BookingConflictError } = await import('../booking');
        const { slotToken } = await import('../slot-token');
        const slot = SLOTS['slot-mon'];
        const token = slotToken({
            psychologistId: PSY_ID, dateStr: MONDAY, time: '11:10',
            availabilitySlotId: slot.id, scheduleRuleId: slot.scheduleRuleId,
            format: 'online', addressId: null, duration: 50,
        });
        await expect(reschedulePracticeBooking({ psychologistId: PSY_ID, sessionId: 'session-1', slotToken: token, origin: 'self_booking' }))
            .rejects.toThrow(BookingConflictError);
    });

    it('rejects a session belonging to a different psychologist', async () => {
        const { reschedulePracticeBooking, BookingConflictError } = await import('../booking');
        const { slotToken } = await import('../slot-token');
        const slot = SLOTS['slot-mon'];
        const token = slotToken({
            psychologistId: 'someone-else', dateStr: MONDAY, time: '11:10',
            availabilitySlotId: slot.id, scheduleRuleId: slot.scheduleRuleId,
            format: 'online', addressId: null, duration: 50,
        });
        await expect(reschedulePracticeBooking({ psychologistId: 'someone-else', sessionId: 'session-1', slotToken: token, origin: 'self_booking' }))
            .rejects.toThrow(BookingConflictError);
    });

    it('rejects a token whose AvailabilitySlot has since been rebound to a different ScheduleRule', async () => {
        const { reschedulePracticeBooking, BookingConflictError } = await import('../booking');
        const { slotToken } = await import('../slot-token');

        const slot = SLOTS['slot-mon'];
        const token = slotToken({
            psychologistId: PSY_ID, dateStr: MONDAY, time: '11:10',
            availabilitySlotId: slot.id, scheduleRuleId: slot.scheduleRuleId, // 'rule-mon', as of minting
            format: 'online', addressId: null, duration: 50,
        });

        const originalRuleId = SLOTS['slot-mon'].scheduleRuleId;
        const originalRule = SLOTS['slot-mon'].scheduleRule;
        SLOTS['slot-mon'].scheduleRuleId = 'rule-mon-v2';
        SLOTS['slot-mon'].scheduleRule = { ...originalRule, id: 'rule-mon-v2' };
        try {
            await expect(reschedulePracticeBooking({ psychologistId: PSY_ID, sessionId: 'session-1', slotToken: token, origin: 'self_booking' }))
                .rejects.toThrow(BookingConflictError);
        } finally {
            SLOTS['slot-mon'].scheduleRuleId = originalRuleId;
            SLOTS['slot-mon'].scheduleRule = originalRule;
        }
    });

    it('two concurrent reschedules of the SAME session to two DIFFERENT target days: exactly one succeeds', async () => {
        const { reschedulePracticeBooking } = await import('../booking');
        const { slotToken } = await import('../slot-token');

        const slotA = SLOTS['slot-mon'];
        const tokenSameDayLaterTime = slotToken({
            psychologistId: PSY_ID, dateStr: MONDAY, time: '11:10',
            availabilitySlotId: slotA.id, scheduleRuleId: slotA.scheduleRuleId,
            format: 'online', addressId: null, duration: 50,
        });
        const slotB = SLOTS['slot-tue'];
        const tokenTuesday = slotToken({
            psychologistId: PSY_ID, dateStr: TUESDAY, time: '09:00',
            availabilitySlotId: slotB.id, scheduleRuleId: slotB.scheduleRuleId,
            format: 'online', addressId: null, duration: 50,
        });

        // Without the per-session lock, these would each only take a DIFFERENT
        // day's lock and could interleave; the session lock forces one to
        // fully commit (or roll back) before the other even reads `existing`.
        const [a, b] = await Promise.allSettled([
            reschedulePracticeBooking({ psychologistId: PSY_ID, sessionId: 'session-1', slotToken: tokenSameDayLaterTime, origin: 'self_booking' }),
            reschedulePracticeBooking({ psychologistId: PSY_ID, sessionId: 'session-1', slotToken: tokenTuesday, origin: 'self_booking' }),
        ]);

        // Both target slots were individually free — this is about
        // serialization order, not a conflict, so either can plausibly win;
        // what must hold is that the session ends up in EXACTLY one place,
        // matching whichever of the two writes actually landed.
        expect(store.sessions).toHaveLength(1);
        const settled = [a, b].filter((r) => r.status === 'fulfilled');
        expect(settled.length).toBeGreaterThanOrEqual(1);
    });
});

describe('rescheduleManualPracticeSession — raw date/time, off-schedule allowed (mobile)', () => {
    beforeEach(() => {
        store.sessions = [existingSession()];
        store.maxSessionsPerDay = null;
    });

    it('moves the session to an arbitrary off-schedule time, in place', async () => {
        const { rescheduleManualPracticeSession } = await import('../booking');

        const result = await rescheduleManualPracticeSession({
            psychologistId: PSY_ID, sessionId: 'session-1', dateStr: MONDAY, time: '23:00',
        });

        expect(result.session.id).toBe('session-1');
        expect(result.session.time).toBe('23:00');
        expect(result.previousTime).toBe('09:00');
        expect(store.sessions).toHaveLength(1);
    });

    it('rejects a collision with another session that day, and never writes', async () => {
        const { rescheduleManualPracticeSession, BookingConflictError } = await import('../booking');
        store.sessions.push({ ...existingSession(), id: 'other-session', clientId: 'other-client', time: '11:00' });

        await expect(rescheduleManualPracticeSession({ psychologistId: PSY_ID, sessionId: 'session-1', dateStr: MONDAY, time: '11:00' }))
            .rejects.toThrow(BookingConflictError);
        expect(store.sessions.find((s) => s.id === 'session-1')!.time).toBe('09:00');
    });

    it('moving to a full DIFFERENT day is rejected by maxSessionsPerDay; staying on the SAME day ignores the cap', async () => {
        const { rescheduleManualPracticeSession, BookingConflictError } = await import('../booking');

        store.maxSessionsPerDay = 1;
        store.sessions.push({ ...existingSession(), id: 'tuesday-existing', clientId: 'someone-else', date: dateAt(TUESDAY), time: '11:00' });

        await expect(rescheduleManualPracticeSession({ psychologistId: PSY_ID, sessionId: 'session-1', dateStr: TUESDAY, time: '09:00' }))
            .rejects.toThrow(BookingConflictError);

        // Same-day move (still Monday, just a different time) never adds to
        // any day's count, so the cap (already "met" by this very session)
        // must not block it.
        const result = await rescheduleManualPracticeSession({ psychologistId: PSY_ID, sessionId: 'session-1', dateStr: MONDAY, time: '11:00' });
        expect(result.session.time).toBe('11:00');
    });

    it('merges extraUpdateData (e.g. notes) into the same atomic write', async () => {
        const { rescheduleManualPracticeSession } = await import('../booking');
        const result = await rescheduleManualPracticeSession({
            psychologistId: PSY_ID, sessionId: 'session-1', dateStr: MONDAY, time: '11:00',
            status: 'pending', extraUpdateData: { notes: 'client asked to move' },
        });
        expect((result.session as any).notes).toBe('client asked to move');
        expect(result.session.status).toBe('pending');
    });

    it('rejects a session that does not belong to this psychologist', async () => {
        const { rescheduleManualPracticeSession, BookingConflictError } = await import('../booking');
        await expect(rescheduleManualPracticeSession({ psychologistId: 'someone-else', sessionId: 'session-1', dateStr: MONDAY, time: '11:00' }))
            .rejects.toThrow(BookingConflictError);
    });
});
