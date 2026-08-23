import { describe, it, expect, vi } from 'vitest';
import { processIngestEvent } from '@/lib/analytics/ingest';

type Db = Parameters<typeof processIngestEvent>[0];
type StoredUser = { id: string; analyticsConsentAt: Date | null };
type StoredDeviceConsent = { deviceId: string; consentAt: Date | null };
interface EventRecord { event: string; deviceId: string | null; [key: string]: unknown }
interface RejectedRecord { reason: string; payload: unknown }

function makeDb(user: StoredUser | null) {
    const events: EventRecord[] = [];
    const rejected: RejectedRecord[] = [];
    let currentUser = user;
    const deviceConsents = new Map<string, StoredDeviceConsent>();

    const db: Db = {
        analyticsEvent: {
            create: (async ({ data }: { data: EventRecord }) => { events.push(data); return data; }) as Db['analyticsEvent']['create'],
            findUnique: (async ({ where }: { where: { eventId: string } }) =>
                events.find((e) => e.eventId === where.eventId) ?? null) as Db['analyticsEvent']['findUnique'],
        },
        analyticsEventRejected: { create: (async ({ data }: { data: RejectedRecord }) => { rejected.push(data); return data; }) as Db['analyticsEventRejected']['create'] },
        user: {
            findUnique: (async () => currentUser) as Db['user']['findUnique'],
            update: (async ({ data }: { data: Partial<StoredUser> }) => {
                currentUser = currentUser ? { ...currentUser, ...data } : currentUser;
                return currentUser;
            }) as Db['user']['update'],
        },
        analyticsDeviceConsent: {
            findUnique: (async ({ where }: { where: { deviceId: string } }) => deviceConsents.get(where.deviceId) ?? null) as Db['analyticsDeviceConsent']['findUnique'],
            upsert: (async ({ where, create, update }: { where: { deviceId: string }; create: StoredDeviceConsent; update: Partial<StoredDeviceConsent> }) => {
                const next = { ...(deviceConsents.get(where.deviceId) ?? create), ...update };
                deviceConsents.set(where.deviceId, next);
                return next;
            }) as Db['analyticsDeviceConsent']['upsert'],
        },
    } as Db;

    return { db, events, rejected, getUser: () => currentUser, getDeviceConsent: (deviceId: string) => deviceConsents.get(deviceId) ?? null };
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

    describe('device without an account (O-260817-13)', () => {
        it('rejects an event with neither account_id nor device_id', async () => {
            const { db, events, rejected } = makeDb(null);
            const result = await processIngestEvent(db, paymentEvent({ account_id: undefined, device_id: undefined }));
            expect(result.accepted).toBe(false);
            expect(events).toHaveLength(0);
            expect(rejected[0].reason).toMatch(/account_id.*device_id/);
        });

        it('rejects a device_id-only event before consent is on file', async () => {
            const { db, events, rejected } = makeDb(null);
            const result = await processIngestEvent(db, paymentEvent({ account_id: undefined, device_id: 'device_anon' }));
            expect(result.accepted).toBe(false);
            expect(events).toHaveLength(0);
            expect(rejected[0].reason).toBe('consent required for a device without an account');
        });

        it('device_id-only consent_updated(granted=true) is itself accepted and unlocks later events', async () => {
            const { db, events, getDeviceConsent } = makeDb(null);
            const now = new Date('2026-08-18T09:00:00Z');
            const consentResult = await processIngestEvent(db, {
                event: 'consent_updated', ts: now.toISOString(), product: 'moments',
                device_id: 'device_anon', schema_version: 1, props: { granted: true },
            }, now);
            expect(consentResult.accepted).toBe(true);
            expect(getDeviceConsent('device_anon')?.consentAt).toEqual(now);

            const result = await processIngestEvent(db, paymentEvent({
                account_id: undefined, device_id: 'device_anon', event: 'payment_succeeded',
            }));
            expect(result.accepted).toBe(true);
            expect(events).toHaveLength(2);
            expect(events[1].accountId).toBeNull();
            expect(events[1].deviceId).toBe('device_anon');
        });

        it('a device that later gets an account is linked by identity_linked without rewriting its past device-only rows', async () => {
            const { db, events } = makeDb({ id: 'user_1', analyticsConsentAt: new Date('2026-08-01T00:00:00Z') });
            await db.analyticsDeviceConsent.upsert({
                where: { deviceId: 'device_anon' },
                create: { deviceId: 'device_anon', consentAt: new Date('2026-08-10T00:00:00Z') },
                update: {},
            });
            await processIngestEvent(db, paymentEvent({ account_id: undefined, device_id: 'device_anon' }));
            const rowBeforeLink = { ...events[0] };

            const result = await processIngestEvent(db, {
                event: 'identity_linked', ts: new Date().toISOString(), product: 'moments',
                account_id: 'user_1', device_id: 'device_anon', schema_version: 1, props: {},
            });

            expect(result.accepted).toBe(true);
            expect(events[0]).toEqual(rowBeforeLink);
            expect(events[1].event).toBe('identity_linked');
            expect(events[1].accountId).toBe('user_1');
        });
    });

    describe('rate limiting by device_id (O-260817-13)', () => {
        it('accepts events under the limit and rejects once a device floods the endpoint', async () => {
            const { db, events, rejected } = makeDb({ id: 'user_1', analyticsConsentAt: new Date() });
            const store = new Map<string, number[]>();
            const now = Date.now();
            let lastResult;
            for (let i = 0; i < 61; i++) {
                lastResult = await processIngestEvent(db, paymentEvent({ device_id: 'device_flood' }), new Date(now), store);
            }
            expect(lastResult?.accepted).toBe(false);
            expect(lastResult && 'reason' in lastResult ? lastResult.reason : null).toBe('rate limited');
            expect(events).toHaveLength(60);
            expect(rejected).toHaveLength(0);
        });

        it('does not rate-limit a fresh device_id after another one floods', async () => {
            const { db, events } = makeDb({ id: 'user_1', analyticsConsentAt: new Date() });
            const store = new Map<string, number[]>();
            const now = Date.now();
            for (let i = 0; i < 61; i++) {
                await processIngestEvent(db, paymentEvent({ device_id: 'device_flood' }), new Date(now), store);
            }
            const result = await processIngestEvent(db, paymentEvent({ device_id: 'device_other' }), new Date(now), store);
            expect(result.accepted).toBe(true);
            expect(events.some((e) => e.deviceId === 'device_other')).toBe(true);
        });
    });

    describe('идемпотентность по event_id (O-260817-17)', () => {
        it('без event_id ведёт себя как раньше — findUnique не вызывается вовсе', async () => {
            const { db, events } = makeDb({ id: 'user_1', analyticsConsentAt: new Date() });
            const findUniqueSpy = vi.spyOn(db.analyticsEvent, 'findUnique');
            await processIngestEvent(db, paymentEvent());
            expect(findUniqueSpy).not.toHaveBeenCalled();
            expect(events).toHaveLength(1);
        });

        it('первая отправка с event_id создаёт строку как обычно', async () => {
            const { db, events } = makeDb({ id: 'user_1', analyticsConsentAt: new Date() });
            const result = await processIngestEvent(db, paymentEvent({ event_id: 'evt_1' }));
            expect(result.accepted).toBe(true);
            expect(events).toHaveLength(1);
            expect(events[0].eventId).toBe('evt_1');
        });

        it('повторная отправка того же event_id — accepted:true, но не создаёт вторую строку', async () => {
            const { db, events } = makeDb({ id: 'user_1', analyticsConsentAt: new Date() });
            await processIngestEvent(db, paymentEvent({ event_id: 'evt_dup' }));
            const second = await processIngestEvent(db, paymentEvent({ event_id: 'evt_dup' }));

            expect(second.accepted).toBe(true);
            expect(events).toHaveLength(1);
        });

        it('повторная отправка с тем же event_id не повторяет побочный эффект consent_updated', async () => {
            const { db, events, getUser } = makeDb({ id: 'user_1', analyticsConsentAt: null });
            const now = new Date('2026-08-18T09:00:00Z');
            const consentEvent = {
                event: 'consent_updated', ts: now.toISOString(), product: 'practice', event_id: 'evt_consent',
                account_id: 'user_1', device_id: 'device_abc', schema_version: 1, props: { granted: true },
            };
            await processIngestEvent(db, consentEvent, now);
            expect(getUser()?.analyticsConsentAt).toEqual(now);

            // Повтор (например, ретрай клиента после таймаута ответа) — не должен
            // ни переписать consent на новое время, ни создать вторую запись.
            const later = new Date('2026-08-18T09:05:00Z');
            const result = await processIngestEvent(db, consentEvent, later);

            expect(result.accepted).toBe(true);
            expect(getUser()?.analyticsConsentAt).toEqual(now); // не сдвинулся на later
            expect(events).toHaveLength(1);
        });

        it('разные event_id для одинаковых по остальным полям событий создают отдельные строки', async () => {
            const { db, events } = makeDb({ id: 'user_1', analyticsConsentAt: new Date() });
            await processIngestEvent(db, paymentEvent({ event_id: 'evt_a' }));
            await processIngestEvent(db, paymentEvent({ event_id: 'evt_b' }));
            expect(events).toHaveLength(2);
        });
    });
});
