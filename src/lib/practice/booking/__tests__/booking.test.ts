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

    const store: { sessions: any[]; maxSessionsPerDay: number | null; clients: any[]; telegramClients: any[]; consentVersions: any[] } =
        { sessions: [], maxSessionsPerDay: null, clients: [], telegramClients: [], consentVersions: [] };

    // FIFO lock-chain: simulates one advisory lock serializing every
    // concurrent $transaction call against the same (psychologist, day) —
    // the only key this test ever uses.
    let lockChain: Promise<unknown> = Promise.resolve();

    const dayFilter = (where: any) => (s: any) =>
        s.psychologistId === where.psychologistId
        && (!where.date || (s.date >= where.date.gte && s.date <= where.date.lte));

    const settingsRow = () => ({ maxSessionsPerDay: store.maxSessionsPerDay, sessionBreak: 15, timezone: 'Europe/Moscow', bookingBufferHours: 0, bookingHorizonDays: 365, blockConflicts: true });

    const diaryClientMatchesPhone = (c: any, where: any) =>
        c.psychologistId === where.psychologistId
        && where.OR.some((cond: any) => c.phone === cond.phone);

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
        diaryClient: {
            findFirst: async ({ where }: any) => store.clients.find((c) => diaryClientMatchesPhone(c, where)) ?? null,
            create: async ({ data }: any) => {
                const row = { id: `client-${store.clients.length + 1}`, consentVersion: null, telegramChatId: null, maxChatId: null, email: null, ...data };
                store.clients.push(row);
                return row;
            },
            update: async ({ where, data }: any) => {
                const c = store.clients.find((c) => c.id === where.id);
                Object.assign(c, data);
                return c;
            },
        },
        telegramClient: {
            findUnique: async ({ where }: any) => store.telegramClients.find((t) => t.telegramUserId === where.telegramUserId) ?? null,
            update: async ({ where, data }: any) => {
                const t = store.telegramClients.find((t) => t.id === where.id);
                Object.assign(t, data);
                return t;
            },
        },
        consentVersion: {
            findFirst: async () => store.consentVersions[0] ?? null,
        },
    };

    const db = {
        // Real Postgres rolls back EVERY write inside a transaction when its
        // callback throws — including a DiaryClient created earlier in the
        // same transaction than the write that ultimately failed. This mock
        // reproduces that: snapshot the mutable store arrays when the
        // transaction starts, and restore them if the callback rejects, so
        // tests can assert "no orphan client" the same way a real rollback
        // would guarantee it.
        $transaction: (fn: any) => {
            const run = lockChain.then(async () => {
                const snapshot = {
                    sessions: store.sessions.map((s) => ({ ...s })),
                    clients: store.clients.map((c) => ({ ...c })),
                    telegramClients: store.telegramClients.map((t) => ({ ...t })),
                };
                try {
                    return await fn(tx);
                } catch (e) {
                    store.sessions.splice(0, store.sessions.length, ...snapshot.sessions);
                    store.clients.splice(0, store.clients.length, ...snapshot.clients);
                    store.telegramClients.splice(0, store.telegramClients.length, ...snapshot.telegramClients);
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

    it('an external Google/Yandex busy block overlapping the slot rejects the booking, even with zero local conflicts', async () => {
        const { createPracticeBooking, BookingConflictError } = await import('../booking');
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

        await expect(createPracticeBooking({
            psychologistId: PSY_ID,
            clientId: 'client-ext-conflict',
            slotToken: token,
            origin: 'self_booking',
            // As if fetched from Google/Yandex before the transaction opened.
            externalBusy: [{ date: dateAt(MONDAY), startTime: '09:00', endTime: '09:50' }],
        })).rejects.toThrow(BookingConflictError);

        expect(store.sessions.filter((s) => s.id.startsWith('session-'))).toHaveLength(0);
    });

    it('rejects a token whose AvailabilitySlot has since been rebound to a different ScheduleRule, even one with identical hours/format/address', async () => {
        const { createPracticeBooking, BookingConflictError } = await import('../booking');
        const { slotToken } = await import('../slot-token');

        const slot = SLOTS['slot-a'];
        const token = slotToken({
            psychologistId: PSY_ID,
            dateStr: MONDAY,
            time: '09:00',
            availabilitySlotId: slot.id,
            scheduleRuleId: slot.scheduleRuleId, // 'rule-a', as it was when the token was minted
            format: 'online',
            addressId: null,
            duration: 50,
        });

        const originalRuleId = SLOTS['slot-a'].scheduleRuleId;
        const originalRule = SLOTS['slot-a'].scheduleRule;
        // Same hours, same format, same address — but a DIFFERENT rule id.
        SLOTS['slot-a'].scheduleRuleId = 'rule-a-v2';
        SLOTS['slot-a'].scheduleRule = { ...originalRule, id: 'rule-a-v2' };

        try {
            await expect(createPracticeBooking({
                psychologistId: PSY_ID,
                clientId: 'client-rebind',
                slotToken: token,
                origin: 'self_booking',
            })).rejects.toThrow(BookingConflictError);
            expect(store.sessions.filter((s) => s.id.startsWith('session-'))).toHaveLength(0);
        } finally {
            SLOTS['slot-a'].scheduleRuleId = originalRuleId;
            SLOTS['slot-a'].scheduleRule = originalRule;
        }
    });
});

describe('createSelfPracticeBooking — atomic client resolution + booking (Task 7 founder review)', () => {
    beforeEach(() => {
        store.sessions = [];
        store.maxSessionsPerDay = null;
        store.clients = [];
        store.telegramClients = [];
        store.consentVersions = [];
    });

    it('creates a new DiaryClient and DiarySession atomically for a first-time booker', async () => {
        const { createSelfPracticeBooking } = await import('../booking');
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

        const result = await createSelfPracticeBooking({
            psychologistId: PSY_ID,
            name: 'Мария',
            phone: '+79991234567',
            slotToken: token,
            telegramInitData: null,
        });

        expect(store.clients).toHaveLength(1);
        expect(result.client.id).toBe(store.clients[0].id);
        expect(result.session.clientId).toBe(result.client.id);
        expect(store.sessions).toHaveLength(1);
    });

    it('a slot conflict leaves NO orphan DiaryClient — client creation rolls back together with the rejected booking', async () => {
        const { createSelfPracticeBooking, BookingConflictError } = await import('../booking');
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

        // Someone else already occupies this exact slot by the time this
        // request reaches the lock.
        store.sessions = [
            { id: 'existing-1', psychologistId: PSY_ID, clientId: 'someone-else', date: dateAt(MONDAY), time: '09:00', duration: 50, status: 'confirmed' },
        ];

        await expect(createSelfPracticeBooking({
            psychologistId: PSY_ID,
            name: 'Новый Клиент',
            phone: '+79997654321',
            slotToken: token,
            telegramInitData: null,
        })).rejects.toThrow(BookingConflictError);

        expect(store.clients).toHaveLength(0);
        expect(store.sessions).toHaveLength(1); // only the pre-existing session, no orphan client and no new session
    });

    it('re-binds an existing client found by phone instead of creating a duplicate', async () => {
        const { createSelfPracticeBooking } = await import('../booking');
        const { slotToken } = await import('../slot-token');

        store.clients = [{ id: 'existing-client', psychologistId: PSY_ID, name: 'Уже клиент', phone: '+79991112233', consentVersion: null, telegramChatId: null, maxChatId: null, email: null, createdAt: new Date() }];

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

        const result = await createSelfPracticeBooking({
            psychologistId: PSY_ID,
            name: 'Уже клиент',
            phone: '+79991112233',
            slotToken: token,
            telegramInitData: null,
        });

        expect(store.clients).toHaveLength(1);
        expect(result.client.id).toBe('existing-client');
        expect(result.session.clientId).toBe('existing-client');
    });
});
