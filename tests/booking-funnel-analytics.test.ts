import { describe, it, expect, afterEach } from 'vitest';
import { loadRegistry, validateEvent, assertEventsHaveQuestions } from '@/lib/analytics/schema';
import { trackBookingFunnelStep, trackBookingCreatedBy } from '@/lib/analytics/booking-funnel';

// O-260817-11 · state/15_ORDERS.md: five booking-funnel events plus
// booking_created_by, added to the same registry/приёмник as billing.

const BOOKING_STEP_EVENTS = [
    'booking_link_opened',
    'booking_time_selected',
    'booking_form_started',
    'booking_consent_shown',
    'booking_completed',
] as const;

// Anything on this list would defeat the order's own rule: "ни одного
// свободного текста, ни имени, ни телефона, ни идентификатора клиента".
// Deliberately excludes the bare word "client" — known_client is a legitimate,
// order-mandated boolean flag, not a client identifier.
const PII_DENYLIST = ['name', 'phone', 'client_id', 'clientId', 'email', 'address', 'text', 'note', 'title'];

describe('booking funnel registry shape', () => {
    const registry = loadRegistry();

    it('defines all five funnel steps plus booking_created_by', () => {
        for (const name of [...BOOKING_STEP_EVENTS, 'booking_created_by']) {
            expect(registry.events[name], `${name} missing from registry`).toBeDefined();
        }
    });

    it.each(BOOKING_STEP_EVENTS)('%s requires channel, link_type, known_client, step and nothing else', (name) => {
        const def = registry.events[name];
        expect(def.required.sort()).toEqual(['channel', 'known_client', 'link_type', 'step'].sort());
        expect(def.optional).toEqual([]);
    });

    it('booking_created_by requires only created_by', () => {
        const def = registry.events.booking_created_by;
        expect(def.required).toEqual(['created_by']);
        expect(def.optional).toEqual([]);
    });

    it('no booking event exposes a PII-shaped field', () => {
        for (const name of [...BOOKING_STEP_EVENTS, 'booking_created_by']) {
            const def = registry.events[name];
            const allowedKeys = [...def.required, ...def.optional];
            for (const forbidden of PII_DENYLIST) {
                expect(allowedKeys, `${name} allows "${forbidden}"`).not.toContain(forbidden);
            }
        }
    });

    it.each([...BOOKING_STEP_EVENTS, 'booking_created_by'])('%s has a non-empty question', (name) => {
        expect(registry.events[name].question?.trim()).toBeTruthy();
    });

    it('assertEventsHaveQuestions rejects an event with no question (charter/12_ANALYTICS.md, правило 3)', () => {
        expect(() => assertEventsHaveQuestions({
            no_question_event: { required: [], optional: [] },
        })).toThrow(/missing a question/);
    });

    it('a prop not declared for a booking event is rejected, same as billing events', () => {
        const result = validateEvent({
            event: 'booking_link_opened',
            ts: new Date().toISOString(),
            product: 'practice',
            account_id: 'psy_1',
            device_id: null,
            schema_version: 1,
            props: { channel: 'telegram', link_type: 'general', known_client: false, step: 1, client_name: 'Иван' },
        }, registry);
        expect(result.valid).toBe(false);
    });

    it('a well-formed booking_completed event validates against the real registry', () => {
        const result = validateEvent({
            event: 'booking_completed',
            ts: new Date().toISOString(),
            product: 'practice',
            account_id: 'psy_1',
            device_id: null,
            schema_version: 1,
            props: { channel: 'browser', link_type: 'personal', known_client: true, step: 5 },
        }, registry);
        expect(result).toEqual({ valid: true });
    });
});

// --- trackBookingFunnelStep / trackBookingCreatedBy -------------------------

type Db = Parameters<typeof trackBookingFunnelStep>[0];
interface EventRecord { event: string; accountId: string; deviceId: string | null; props: unknown }

function makeDb() {
    const events: EventRecord[] = [];
    const db = {
        analyticsEvent: { create: (async ({ data }: { data: EventRecord }) => { events.push(data); return data; }) as Db['analyticsEvent']['create'] },
        analyticsEventRejected: { create: (async () => ({})) as Db['analyticsEventRejected']['create'] },
        user: { findUnique: (async () => ({ id: 'psy_1', analyticsConsentAt: new Date() })) as Db['user']['findUnique'] },
    } as Db;
    return { db, events };
}

const ORIGINAL_FLAG = process.env.ANALYTICS_INGEST_ENABLED;
afterEach(() => {
    process.env.ANALYTICS_INGEST_ENABLED = ORIGINAL_FLAG;
});

describe('trackBookingFunnelStep', () => {
    it('does nothing while ANALYTICS_INGEST_ENABLED is off (default)', async () => {
        delete process.env.ANALYTICS_INGEST_ENABLED;
        const { db, events } = makeDb();
        const result = await trackBookingFunnelStep(db, 'psy_1', 'booking_link_opened', { channel: 'telegram', linkType: 'general', knownClient: false });
        expect(result.accepted).toBe(false);
        expect(events).toHaveLength(0);
    });

    it('writes a booking_link_opened event scoped to the psychologist account once enabled', async () => {
        process.env.ANALYTICS_INGEST_ENABLED = 'true';
        const { db, events } = makeDb();
        const result = await trackBookingFunnelStep(db, 'psy_1', 'booking_time_selected', { channel: 'max', linkType: 'personal', knownClient: true });
        expect(result.accepted).toBe(true);
        expect(events).toHaveLength(1);
        expect(events[0].event).toBe('booking_time_selected');
        expect(events[0].accountId).toBe('psy_1');
        expect(events[0].props).toEqual({ channel: 'max', link_type: 'personal', known_client: true, step: 2 });
    });

    it('carries no name/phone/client id anywhere in the written props', async () => {
        process.env.ANALYTICS_INGEST_ENABLED = 'true';
        const { db, events } = makeDb();
        await trackBookingFunnelStep(db, 'psy_1', 'booking_completed', { channel: 'browser', linkType: 'general', knownClient: false });
        const serialized = JSON.stringify(events[0].props);
        for (const forbidden of PII_DENYLIST) {
            expect(serialized.toLowerCase()).not.toContain(forbidden.toLowerCase());
        }
    });
});

describe('trackBookingCreatedBy', () => {
    it('does nothing while the ingest flag is off', async () => {
        delete process.env.ANALYTICS_INGEST_ENABLED;
        const { db, events } = makeDb();
        const result = await trackBookingCreatedBy(db, 'psy_1', 'client');
        expect(result.accepted).toBe(false);
        expect(events).toHaveLength(0);
    });

    it('records who created the session — client', async () => {
        process.env.ANALYTICS_INGEST_ENABLED = 'true';
        const { db, events } = makeDb();
        await trackBookingCreatedBy(db, 'psy_1', 'client');
        expect(events[0].props).toEqual({ created_by: 'client' });
    });

    it('records who created the session — specialist', async () => {
        process.env.ANALYTICS_INGEST_ENABLED = 'true';
        const { db, events } = makeDb();
        await trackBookingCreatedBy(db, 'psy_1', 'specialist');
        expect(events[0].props).toEqual({ created_by: 'specialist' });
    });
});
