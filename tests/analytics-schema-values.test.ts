// Валидация перечислений (surface/to/mode/channel/*_bucket) — семь событий
// мобильного приложения ПРАКТИКИ (решение учредителя 5: "Перечисления
// валидируются НА СЕРВЕРЕ"). EventDef.values?: Record<string, string[]> —
// поле необязательное: ЗАПИСКИ и МОМЕНТЫ не объявляют его вовсе, их events
// не должны быть затронуты этой проверкой.

import { describe, it, expect } from 'vitest';
import { validateEvent, EventRegistry } from '@/lib/analytics/schema';

const registryWithValues: EventRegistry = {
    version: 1,
    products: ['practice'],
    events: {
        session_status_changed: {
            product: 'practice',
            required: ['surface', 'to', 'delivered'],
            optional: [],
            props: { surface: 'string', to: 'string', delivered: 'boolean' },
            values: {
                surface: ['android'],
                to: ['confirmed', 'completed', 'cancelled', 'rescheduled'],
            },
        },
        // Событие без values вовсе — проверка перечислений не должна на
        // него влиять (это и есть "не затронуто").
        payment_succeeded: {
            product: 'practice',
            required: ['terminal', 'plan', 'amount', 'months'],
            optional: [],
            props: { terminal: 'string', plan: 'string', amount: 'number', months: 'number' },
        },
    },
};

function statusEvent(overrides: Record<string, unknown> = {}) {
    return {
        event: 'session_status_changed',
        ts: new Date().toISOString(),
        product: 'practice',
        account_id: 'user_1',
        device_id: null,
        schema_version: 1,
        props: { surface: 'android', to: 'confirmed', delivered: true },
        ...overrides,
    };
}

describe('validateEvent: значения перечислений (EventDef.values)', () => {
    it('отвергает значение вне списка допустимых', () => {
        const result = validateEvent(
            statusEvent({ props: { surface: 'android', to: 'exploded', delivered: true } }),
            registryWithValues,
        );
        expect(result.valid).toBe(false);
    });

    it('принимает значение из списка допустимых', () => {
        const result = validateEvent(statusEvent(), registryWithValues);
        expect(result).toEqual({ valid: true });
    });

    it('отвергает значение вне списка для второго перечисляемого свойства того же события (surface)', () => {
        const result = validateEvent(
            statusEvent({ props: { surface: 'ios', to: 'confirmed', delivered: true } }),
            registryWithValues,
        );
        expect(result.valid).toBe(false);
    });

    it('событие без объявленных values не затронуто проверкой перечислений', () => {
        const event = {
            event: 'payment_succeeded',
            ts: new Date().toISOString(),
            product: 'practice',
            account_id: 'user_1',
            device_id: null,
            schema_version: 1,
            props: { terminal: 'anything-goes', plan: 'anything', amount: 1, months: 1 },
        };
        expect(validateEvent(event, registryWithValues)).toEqual({ valid: true });
    });

    it('проверка перечислений идёт ПОСЛЕ проверки типов: неверный тип отвергается своей причиной, а не "не в списке"', () => {
        const result = validateEvent(
            statusEvent({ props: { surface: 'android', to: 'confirmed', delivered: 'yes' } }),
            registryWithValues,
        );
        expect(result.valid).toBe(false);
        if (!result.valid) expect(result.reason).toMatch(/must be boolean/);
    });
});

describe('validateEvent против реального реестра: семь событий мобильного приложения ПРАКТИКИ', () => {
    it('app_opened принимает surface=android', () => {
        const event = {
            event: 'app_opened',
            ts: new Date().toISOString(),
            product: 'practice',
            account_id: 'user_1',
            device_id: null,
            schema_version: 1,
            props: { surface: 'android', first_launch: true },
        };
        expect(validateEvent(event).valid).toBe(true);
    });

    it('app_opened отвергает surface вне списка', () => {
        const event = {
            event: 'app_opened',
            ts: new Date().toISOString(),
            product: 'practice',
            account_id: 'user_1',
            device_id: null,
            schema_version: 1,
            props: { surface: 'ios' },
        };
        expect(validateEvent(event).valid).toBe(false);
    });

    it('session_status_changed отвергает to вне списка', () => {
        const event = {
            event: 'session_status_changed',
            ts: new Date().toISOString(),
            product: 'practice',
            account_id: 'user_1',
            device_id: null,
            schema_version: 1,
            props: { surface: 'android', to: 'deleted', delivered: true },
        };
        expect(validateEvent(event).valid).toBe(false);
    });

    it('client_invite_created отвергает channel вне списка', () => {
        const event = {
            event: 'client_invite_created',
            ts: new Date().toISOString(),
            product: 'practice',
            account_id: 'user_1',
            device_id: null,
            schema_version: 1,
            props: { surface: 'android', channel: 'whatsapp', delivered: true },
        };
        expect(validateEvent(event).valid).toBe(false);
    });

    it('client_invite_created принимает channel из списка', () => {
        const event = {
            event: 'client_invite_created',
            ts: new Date().toISOString(),
            product: 'practice',
            account_id: 'user_1',
            device_id: null,
            schema_version: 1,
            props: { surface: 'android', channel: 'telegram', delivered: true },
        };
        expect(validateEvent(event).valid).toBe(true);
    });

    it('session_note_saved отвергает blocks_filled вне диапазона 0..5', () => {
        const event = {
            event: 'session_note_saved',
            ts: new Date().toISOString(),
            product: 'practice',
            account_id: 'user_1',
            device_id: null,
            schema_version: 1,
            props: { surface: 'android', delivered: true, mode: 'blocks', blocks_filled: 6 },
        };
        expect(validateEvent(event).valid).toBe(false);
    });

    it('session_note_saved принимает blocks_filled внутри диапазона 0..5', () => {
        const event = {
            event: 'session_note_saved',
            ts: new Date().toISOString(),
            product: 'practice',
            account_id: 'user_1',
            device_id: null,
            schema_version: 1,
            props: { surface: 'android', delivered: true, mode: 'blocks', blocks_filled: 5 },
        };
        expect(validateEvent(event).valid).toBe(true);
    });

    it('session_note_saved отвергает since_session_bucket вне списка', () => {
        const event = {
            event: 'session_note_saved',
            ts: new Date().toISOString(),
            product: 'practice',
            account_id: 'user_1',
            device_id: null,
            schema_version: 1,
            props: { surface: 'android', delivered: true, mode: 'short', since_session_bucket: 'yesterday' },
        };
        expect(validateEvent(event).valid).toBe(false);
    });
});
