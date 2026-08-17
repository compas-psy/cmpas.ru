import { describe, it, expect } from 'vitest';
import { validateEvent, loadRegistry, EventRegistry } from '@/lib/analytics/schema';

const registry: EventRegistry = {
    version: 1,
    products: ['practice'],
    events: {
        payment_succeeded: {
            required: ['terminal', 'plan', 'amount', 'months'],
            optional: [],
            props: { terminal: 'string', plan: 'string', amount: 'number', months: 'number' },
        },
        consent_updated: {
            required: ['granted'],
            optional: [],
            props: { granted: 'boolean' },
        },
    },
};

function baseEvent(overrides: Record<string, unknown> = {}) {
    return {
        event: 'payment_succeeded',
        ts: new Date().toISOString(),
        product: 'practice',
        account_id: 'user_1',
        device_id: null,
        schema_version: 1,
        props: { terminal: 'site', plan: 'practice', amount: 99000, months: 1 },
        ...overrides,
    };
}

describe('validateEvent (charter/12_ANALYTICS.md §3)', () => {
    it('accepts a well-formed known event', () => {
        expect(validateEvent(baseEvent(), registry)).toEqual({ valid: true });
    });

    it('rejects an unknown event name', () => {
        expect(validateEvent(baseEvent({ event: 'made_up_event' }), registry).valid).toBe(false);
    });

    it('rejects an unknown product', () => {
        expect(validateEvent(baseEvent({ product: 'nonexistent' }), registry).valid).toBe(false);
    });

    it('rejects a prop not declared for the event — this is how rebillId/password could never sneak in', () => {
        const result = validateEvent(
            baseEvent({ props: { terminal: 'site', plan: 'practice', amount: 1, months: 1, rebillId: '12345' } }),
            registry
        );
        expect(result.valid).toBe(false);
    });

    it('rejects a missing required prop', () => {
        expect(validateEvent(baseEvent({ props: { terminal: 'site', plan: 'practice' } }), registry).valid).toBe(false);
    });

    it('rejects a prop of the wrong type', () => {
        const result = validateEvent(
            baseEvent({ props: { terminal: 'site', plan: 'practice', amount: '99000', months: 1 } }),
            registry
        );
        expect(result.valid).toBe(false);
    });

    it('rejects a missing account_id', () => {
        expect(validateEvent(baseEvent({ account_id: undefined }), registry).valid).toBe(false);
    });

    it('rejects an invalid ts', () => {
        expect(validateEvent(baseEvent({ ts: 'not-a-date' }), registry).valid).toBe(false);
    });

    it('loads the real registry without throwing and knows the required events', () => {
        const real = loadRegistry();
        expect(real.events.payment_succeeded).toBeDefined();
        expect(real.events.consent_updated).toBeDefined();
        expect(real.events.identity_linked).toBeDefined();
    });
});
