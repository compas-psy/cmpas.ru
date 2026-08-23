import { describe, it, expect } from 'vitest';
import { validateEvent, loadRegistry, EventRegistry } from '@/lib/analytics/schema';

const registry: EventRegistry = {
    version: 1,
    products: ['practice'],
    events: {
        payment_succeeded: {
            product: 'practice',
            required: ['terminal', 'plan', 'amount', 'months'],
            optional: [],
            props: { terminal: 'string', plan: 'string', amount: 'number', months: 'number' },
        },
        consent_updated: {
            product: 'practice',
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

    it('rejects a known event submitted under a product it does not belong to', () => {
        const withZapiski: EventRegistry = { ...registry, products: [...registry.products, 'zapiski'] };
        expect(validateEvent(baseEvent({ product: 'zapiski' }), withZapiski).valid).toBe(false);
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

describe('validateEvent against the real registry, one event per product (O-260817-17)', () => {
    it('accepts a well-formed practice event', () => {
        expect(validateEvent(baseEvent()).valid).toBe(true);
    });

    it('accepts a well-formed zapiski event', () => {
        const event = {
            event: 'note_saved',
            ts: new Date().toISOString(),
            product: 'zapiski',
            account_id: 'user_1',
            device_id: null,
            schema_version: 1,
            props: { length_bucket: 'm', encrypted: true },
        };
        expect(validateEvent(event).valid).toBe(true);
    });

    it('accepts a well-formed moments event', () => {
        const event = {
            event: 'practice_started',
            ts: new Date().toISOString(),
            product: 'moments',
            account_id: 'user_1',
            device_id: null,
            schema_version: 1,
            props: { practice_id: 'sleep_01', group: 'SLEEP', is_sleep: true },
        };
        expect(validateEvent(event).valid).toBe(true);
    });

    it('rejects a zapiski event carrying a prop not in the registry', () => {
        const event = {
            event: 'note_saved',
            ts: new Date().toISOString(),
            product: 'zapiski',
            account_id: 'user_1',
            device_id: null,
            schema_version: 1,
            props: { length_bucket: 'm', encrypted: true, note_text: 'клиент рассказал про развод' },
        };
        expect(validateEvent(event).valid).toBe(false);
    });

    it('rejects a moments event submitted under a different product', () => {
        const event = {
            event: 'practice_started',
            ts: new Date().toISOString(),
            product: 'practice',
            account_id: 'user_1',
            device_id: null,
            schema_version: 1,
            props: { practice_id: 'sleep_01', group: 'SLEEP', is_sleep: true },
        };
        expect(validateEvent(event).valid).toBe(false);
    });

    it('rejects an event of an unknown product for that product\'s own name', () => {
        const event = {
            event: 'note_saved',
            ts: new Date().toISOString(),
            product: 'momenty',
            account_id: 'user_1',
            device_id: null,
            schema_version: 1,
            props: { length_bucket: 'm', encrypted: true },
        };
        const result = validateEvent(event);
        expect(result.valid).toBe(false);
        if (!result.valid) expect(result.reason).toMatch(/unknown product/);
    });
});

describe('validateEvent: события на несколько продуктов сразу (E1, контракт контура v2 п.6)', () => {
    function consentEvent(product: string) {
        return {
            event: 'consent_updated',
            ts: new Date().toISOString(),
            product,
            account_id: 'subject_1',
            device_id: null,
            schema_version: 1,
            props: { granted: true },
        };
    }

    it('consent_updated принимается под practice', () => {
        expect(validateEvent(consentEvent('practice')).valid).toBe(true);
    });

    it('consent_updated принимается под zapiski', () => {
        expect(validateEvent(consentEvent('zapiski')).valid).toBe(true);
    });

    it('consent_updated принимается под moments', () => {
        expect(validateEvent(consentEvent('moments')).valid).toBe(true);
    });

    it('identity_linked тоже принадлежит всем трём продуктам', () => {
        const event = {
            event: 'identity_linked',
            ts: new Date().toISOString(),
            product: 'zapiski',
            account_id: 'subject_1',
            device_id: null,
            schema_version: 1,
            props: {},
        };
        expect(validateEvent(event).valid).toBe(true);
    });

    it('событие своего продукта (не consent_updated/identity_linked) по-прежнему принимается только под своим продуктом', () => {
        const event = {
            event: 'note_saved',
            ts: new Date().toISOString(),
            product: 'zapiski',
            account_id: 'subject_1',
            device_id: null,
            schema_version: 1,
            props: { length_bucket: 'm', encrypted: true },
        };
        expect(validateEvent(event).valid).toBe(true);
    });

    it('чужой продукт для однопродуктового события отвергается с внятной причиной', () => {
        const event = {
            event: 'note_saved',
            ts: new Date().toISOString(),
            product: 'moments',
            account_id: 'subject_1',
            device_id: null,
            schema_version: 1,
            props: { length_bucket: 'm', encrypted: true },
        };
        const result = validateEvent(event);
        expect(result.valid).toBe(false);
        if (!result.valid) expect(result.reason).toBe('event note_saved belongs to product zapiski, not moments');
    });
});

describe('validateEvent + event_id (O-260817-17, идемпотентность)', () => {
    it('event_id отсутствует — валиден как раньше', () => {
        expect(validateEvent(baseEvent()).valid).toBe(true);
    });

    it('event_id — строка — валиден', () => {
        expect(validateEvent(baseEvent({ event_id: 'evt_123' })).valid).toBe(true);
    });

    it('event_id — не строка — отказ', () => {
        expect(validateEvent(baseEvent({ event_id: 12345 })).valid).toBe(false);
    });
});
