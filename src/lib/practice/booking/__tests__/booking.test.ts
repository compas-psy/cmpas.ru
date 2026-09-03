// Task 7 (PRAKTIKA MVP) — the founder-mandated concurrency acceptance test:
//
//   const [a, b] = await Promise.allSettled([
//     createPracticeBooking(input),
//     createPracticeBooking(input),
//   ]);
//   expect(a.status === 'fulfilled' || b.status === 'fulfilled').toBe(true);
//   expect(await countSessionsAtSlot()).toBe(1);
//
// plus the explicit follow-up: with maxSessionsPerDay=4 and bookedCount=3,
// the resolver may legitimately still offer several open times (it only
// checks the cap once, up front, against the real count) — but the ACTUAL
// commit must re-check that same cap again inside the lock. Two concurrent
// bookings for two DIFFERENT otherwise-valid times that day: the first
// becomes booking #4 and succeeds, the second re-reads bookedCount INSIDE
// the lock, sees 4 >= 4, and is rejected — never becoming a 5th session.
//
// There is no live Postgres in this sandbox to exercise the real
// `pg_advisory_xact_lock` SQL, so `db.$transaction` is mocked as a strict
// FIFO queue: each call waits for the previous one to fully settle before
// its callback runs. That is exactly the serialization an advisory lock on
// the same (psychologist, day) key gives two real concurrent transactions —
// this test proves the BODY of createPracticeBooking is correct under that
// serialization, which is the part unit-testable without a live database.

import { describe, it, expect, beforeEach, vi } from 'vitest';

const PSY_ID = 'psy-1';
const MONDAY = '2026-09-07';

const { store, db, SLOTS } = vi.hoisted(() => {
    const onlineSlot = {
        id: 'slot-a',
        psychologistId: 'psy-1',
        dayOfWeek: 0, // Monday
        startTime: '09:00',
        endTime: '13:00',
        duration: null,
        format: null,
        addressId: null,
        isActive: true,
        startDate: null,
        endDate: null,
        scheduleRuleId: 'rule-a',
        scheduleRule: {
            id: 'rule-a',
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

    const offlineSlot = {
        id: 'slot-offline',
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
        scheduleRuleId: 'rule-offline',
        scheduleRule: {
            id: 'rule-offline',
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

    const SLOTS: Record<string, any> = {
        [onlineSlot.id]: onlineSlot,
        [offlineSlot.id]: offlineSlot,
    };

    const store: { sessions: any[]; maxSessionsPerDay: number | null } = { sessions: [], maxSessionsPerDay: null };

    // FIFO lock-chain: simulates one advisory lock serializing every
    // concurrent $transaction call against the same (psychologist, day) —
    // the only key this test ever uses.
    let lockChain: Promise<unknown> = Promise.resolve();

    const dayFilter = (where: any) => (s: any) =>
        s.psychologistId === where.psychologistId
        && (!where.date || (s.date >= where.date.gte && s.date <= where.date.lte));

    const tx = {
        $executeRaw: async () => undefined,
        psychologistSettings: {
            findUnique: async () => ({ maxSessionsPerDay: store.maxSessionsPerDay, sessionBreak: 15, timezone: 'Europe/Moscow', bookingBufferHours: 0, bookingHorizonDays: 365 }),
        },
        availabilitySlot: {
            findFirst: async ({ where }: any) => {
                const slot = SLOTS[where.id];
                return slot && slot.psychologistId === where.psychologistId ? { ...slot } : null;
            },
        },
        diarySession: {
            findMany: async ({ where }: any) => store.sessions.filter(dayFilter(where)),
            create: async ({ data }: any) => {
                const row = { id: `session-${store.sessions.length + 1}`, ...data };
                store.sessions.push(row);
                return row;
            },
        },
        diaryBlock: {
            findMany: async () => [],
        },
    };

    const db = {
        $transaction: (fn: any) => {
            const run = lockChain.then(() => fn(tx));
            lockChain = run.then(() => undefined, () => undefined);
            return run;
        },
    };

    return { store, db, SLOTS };
});

vi.mock('@/lib/db', () => ({ db }));

function dateAt(dateStr: string): Date {
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d));
}

describe('createPracticeBooking — atomic, lock-serialized booking', () => {
    beforeEach(() => {
        store.sessions = [];
        store.maxSessionsPerDay = null;
    });

    it('two concurrent bookings for the SAME exact slot: exactly one succeeds, one conflict, one session exists', async () => {
        const { createPracticeBooking } = await import('../booking');
        const { slotToken } = await import('../slot-token');

        const slot = SLOTS['slot-a'];
        const token = slotToken({
            psychologistId: PSY_ID,
            dateStr: MONDAY,
            time: '09:00',
            availabilitySlotId: slot.id,
            scheduleRuleId: slot.scheduleRuleId,
            format: 'online',
            addressId: null,
            duration: 50,
        });

        const [a, b] = await Promise.allSettled([
            createPracticeBooking({ psychologistId: PSY_ID, clientId: 'client-a', slotToken: token, origin: 'self_booking' }),
            createPracticeBooking({ psychologistId: PSY_ID, clientId: 'client-b', slotToken: token, origin: 'self_booking' }),
        ]);

        expect(a.status === 'fulfilled' || b.status === 'fulfilled').toBe(true);
        expect(a.status === 'rejected' || b.status === 'rejected').toBe(true);

        const atSlot = store.sessions.filter((s) => s.time === '09:00');
        expect(atSlot).toHaveLength(1);
    });

    it('maxSessionsPerDay is re-checked INSIDE the lock: bookedCount=3, cap=4 — one of two concurrent bookings for DIFFERENT times fills slot 4, the other is rejected as the 5th', async () => {
        const { createPracticeBooking } = await import('../booking');
        const { slotToken } = await import('../slot-token');

        store.maxSessionsPerDay = 4;
        // 3 already booked, well outside the 09:00-13:00 window this test uses.
        store.sessions = [
            { id: 'existing-1', psychologistId: PSY_ID, clientId: 'existing-client-1', date: dateAt(MONDAY), time: '06:00', duration: 50, status: 'confirmed' },
            { id: 'existing-2', psychologistId: PSY_ID, clientId: 'existing-client-2', date: dateAt(MONDAY), time: '07:00', duration: 50, status: 'confirmed' },
            { id: 'existing-3', psychologistId: PSY_ID, clientId: 'existing-client-3', date: dateAt(MONDAY), time: '08:00', duration: 50, status: 'confirmed' },
        ];

        const slot = SLOTS['slot-a'];
        const tokenFor = (time: string) => slotToken({
            psychologistId: PSY_ID,
            dateStr: MONDAY,
            time,
            availabilitySlotId: slot.id,
            scheduleRuleId: slot.scheduleRuleId,
            format: 'online',
            addressId: null,
            duration: 50,
        });

        const [a, b] = await Promise.allSettled([
            createPracticeBooking({ psychologistId: PSY_ID, clientId: 'client-c', slotToken: tokenFor('10:05'), origin: 'self_booking' }),
            createPracticeBooking({ psychologistId: PSY_ID, clientId: 'client-d', slotToken: tokenFor('11:10'), origin: 'self_booking' }),
        ]);

        // Both times were individually valid per the resolver BEFORE either
        // committed (bookedCount=3 < 4) — the cap can only correctly reject
        // the second one once the first has actually committed, i.e. only if
        // it's re-read INSIDE the lock rather than trusted from a pre-lock
        // snapshot.
        expect(a.status === 'fulfilled' || b.status === 'fulfilled').toBe(true);
        expect(a.status === 'rejected' || b.status === 'rejected').toBe(true);

        const confirmedNew = store.sessions.filter((s) => s.id.startsWith('session-'));
        expect(confirmedNew).toHaveLength(1);
        expect(store.sessions).toHaveLength(4); // never a 5th
    });

    it('rejects with INVALID_TOKEN for a tampered/expired token — never reaches the lock', async () => {
        const { createPracticeBooking, BookingConflictError } = await import('../booking');

        await expect(createPracticeBooking({
            psychologistId: PSY_ID,
            clientId: 'client-x',
            slotToken: 'slt1_garbage',
            origin: 'self_booking',
        })).rejects.toThrow(BookingConflictError);
    });

    it('persists addressId and duration exactly as encoded in the token (offline booking)', async () => {
        const { createPracticeBooking } = await import('../booking');
        const { slotToken } = await import('../slot-token');

        const slot = SLOTS['slot-offline'];
        const token = slotToken({
            psychologistId: PSY_ID,
            dateStr: MONDAY,
            time: '09:00',
            availabilitySlotId: slot.id,
            scheduleRuleId: slot.scheduleRuleId,
            format: 'offline',
            addressId: 'address-yauzskaya',
            duration: 50,
        });

        const session = await createPracticeBooking({
            psychologistId: PSY_ID,
            clientId: 'client-offline',
            slotToken: token,
            origin: 'self_booking',
        });

        expect(session.format).toBe('offline');
        expect(session.addressId).toBe('address-yauzskaya');
        expect(session.duration).toBe(50);
        expect(session.origin).toBe('self_booking');
    });
});
