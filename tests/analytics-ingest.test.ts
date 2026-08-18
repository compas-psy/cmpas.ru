import { describe, it, expect } from 'vitest';
import { processIngestEvent } from '@/lib/analytics/ingest';

type Db = Parameters<typeof processIngestEvent>[0];
type StoredUser = { id: string; analyticsConsentAt: Date | null };
interface EventRecord { event: string; deviceId: string | null; [key: string]: unknown }
interface RejectedRecord { reason: string; payload: unknown }

function makeDb(user: StoredUser | null) {
    const events: EventRecord[] = [];
    const rejected: RejectedRecord[] = [];
    let currentUser = user;

    const db: Db = {
        analyticsEvent: { create: (async ({ data }: { data: EventRecord }) => { events.push(data); return data; }) as Db['analyticsEvent']['create'] },
        analyticsEventRejected: { create: (async ({ data }: { data: RejectedRecord }) => { rejected.push(data); return data; }) as Db['analyticsEventRejected']['create'] },
        user: {
            findUnique: (async () => currentUser) as Db['user']['findUnique'],
            update: (async ({ data }: { data: Partial<StoredUser> }) => {
                currentUser = currentUser ? { ...currentUser, ...data } : currentUser;
                return currentUser;
            }) as Db['user']['update'],
        },
    } as Db;

    return { db, events, rejected, getUser: () => currentUser };
}

function paymentEvent(overrides: Record<string, unknown> = {}) {
    return {
        event: 'payment_succeeded',
        ts: new Date().toISOString(),
        product: 'practice',
        account_id: 'user_1',
        device_id: 'device_1',
        schema_version: 1,
        props: { terminal: 'site', plan: 'practice', amount: 99000, months: 1 },
        ...overrides,
    };
}

describe('processIngestEvent', () => {
    it('rejects a malformed event without touching the events table', async () => {
        const { db, events, rejected } = makeDb({ id: 'user_1', analyticsConsentAt: new Date() });
        const result = await processIngestEvent(db, { event: 'not_a_real_event' });
        expect(result.accepted).toBe(false);
        expect(events).toHaveLength(0);
        expect(rejected).toHaveLength(1);
    });

    it('rejects an unknown account_id', async () => {
        const { db, events, rejected } = makeDb(null);
        const result = await processIngestEvent(db, paymentEvent());
        expect(result.accepted).toBe(false);
        expect(events).toHaveLength(0);
        expect(rejected[0].reason).toBe('unknown account_id');
    });

    it('rejects an event of an unknown product into events_rejected with a reason (O-260817-17)', async () => {
        const { db, events, rejected } = makeDb({ id: 'user_1', analyticsConsentAt: new Date() });
        const result = await processIngestEvent(db, paymentEvent({ product: 'momenty' }));
        expect(result.accepted).toBe(false);
        expect(events).toHaveLength(0);
        expect(rejected[0].reason).toMatch(/unknown product/);
    });

    it('a prop outside the registry (e.g. rebillId) never reaches the events table', async () => {
        const { db, events, rejected } = makeDb({ id: 'user_1', analyticsConsentAt: new Date() });
        const result = await processIngestEvent(db, paymentEvent({
            props: { terminal: 'site', plan: 'practice', amount: 99000, months: 1, rebillId: 'leak-attempt' },
        }));
        expect(result.accepted).toBe(false);
        expect(events).toHaveLength(0);
        expect(rejected).toHaveLength(1);
    });

    it('passes device_id through once the account has given consent', async () => {
        const { db, events } = makeDb({ id: 'user_1', analyticsConsentAt: new Date() });
        await processIngestEvent(db, paymentEvent({ device_id: 'device_abc' }));
        expect(events[0].deviceId).toBe('device_abc');
    });

    it('nulls device_id when the account has not given consent (charter/12_ANALYTICS.md rule)', async () => {
        const { db, events } = makeDb({ id: 'user_1', analyticsConsentAt: null });
        await processIngestEvent(db, paymentEvent({ device_id: 'device_abc' }));
        expect(events[0].deviceId).toBeNull();
    });

    it('consent_updated with granted=true records consent and keeps its own device_id', async () => {
        const { db, events, getUser } = makeDb({ id: 'user_1', analyticsConsentAt: null });
        const now = new Date('2026-08-17T12:00:00Z');
        await processIngestEvent(db, {
            event: 'consent_updated', ts: now.toISOString(), product: 'practice',
            account_id: 'user_1', device_id: 'device_abc', schema_version: 1, props: { granted: true },
        }, now);

        expect(getUser()?.analyticsConsentAt).toEqual(now);
        expect(events[0].deviceId).toBe('device_abc');
    });

    it('consent_updated with granted=false revokes consent and nulls device_id', async () => {
        const { db, events, getUser } = makeDb({ id: 'user_1', analyticsConsentAt: new Date() });
        await processIngestEvent(db, {
            event: 'consent_updated', ts: new Date().toISOString(), product: 'practice',
            account_id: 'user_1', device_id: 'device_abc', schema_version: 1, props: { granted: false },
        });

        expect(getUser()?.analyticsConsentAt).toBeNull();
        expect(events[0].deviceId).toBeNull();
    });

    it('a subsequent event after consent was given still carries device_id', async () => {
        const { db, events } = makeDb({ id: 'user_1', analyticsConsentAt: new Date('2026-08-01T00:00:00Z') });
        await processIngestEvent(db, paymentEvent({ device_id: 'device_xyz' }));
        expect(events[0].deviceId).toBe('device_xyz');
    });
});
