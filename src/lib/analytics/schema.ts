// Validates events against analytics/schema/events.yaml before POST /ingest
// writes anything (charter/12_ANALYTICS.md §3). Unknown event names, unknown
// products, or props not declared for that event are rejected — never
// silently accepted, and never silently dropped either (the caller decides
// what to do with a rejection, this module only judges).
//
// O-260817-17: every event belongs to a product (the registry's `products`
// list is who may call /ingest at all, `events.<name>.product` is which of
// them owns that specific event name) — an event submitted under a product
// it doesn't belong to is rejected the same as an unknown event.
//
// E1 (контракт контура v2 п.6): `product` is usually a single string, but
// consent_updated and identity_linked belong to all three products at once
// — the registry spells that as a YAML list. `eventProducts()` normalizes
// either shape to an array so callers never branch on which one they got.

import fs from 'fs';
import path from 'path';
import { load } from 'js-yaml';

export interface EventDef {
    product: string | string[];
    required: string[];
    optional: string[];
    props?: Record<string, 'string' | 'number' | 'boolean'>;
    question?: string;
    // Допустимые значения для перечисляемых props (решение учредителя:
    // "Перечисления (surface, to, mode, channel, все *_bucket) валидируются
    // НА СЕРВЕРЕ"). Необязательно — ЗАПИСКИ и МОМЕНТЫ не объявляют его
    // вовсе, их события этой проверкой не затронуты. Проверяется ПОСЛЕ
    // проверки типов (см. validateEvent), чтобы неверный тип отвечал своей
    // причиной, а не "значение не в списке".
    values?: Record<string, string[]>;
    // Диапазон для целочисленных props, объявленных как `number` (например
    // blocks_filled: 0..5) — то же самое решение учредителя, но для чисел,
    // а не строк, поэтому отдельное поле от `values`. Тоже необязательное,
    // тоже проверяется после проверки типов.
    range?: Record<string, [number, number]>;
}

/** Normalizes `EventDef.product` (string or list) to the list of products allowed to send this event. */
export function eventProducts(def: EventDef): string[] {
    return Array.isArray(def.product) ? def.product : [def.product];
}

export interface EventRegistry {
    version: number;
    products: string[];
    events: Record<string, EventDef>;
}

let cached: EventRegistry | null = null;

export function loadRegistry(): EventRegistry {
    if (!cached) {
        const file = path.join(process.cwd(), 'analytics/schema/events.yaml');
        cached = load(fs.readFileSync(file, 'utf8')) as EventRegistry;
    }
    return cached;
}

export interface RawEvent {
    event?: unknown;
    ts?: unknown;
    product?: unknown;
    account_id?: unknown;
    device_id?: unknown;
    props?: unknown;
    schema_version?: unknown;
    // Идемпотентность POST /ingest (O-260817-17) — необязателен, отсутствие
    // не меняет поведение (см. src/lib/analytics/ingest.ts).
    event_id?: unknown;
}

export type ValidationResult = { valid: true } | { valid: false; reason: string };

export function validateEvent(raw: RawEvent, registry: EventRegistry = loadRegistry()): ValidationResult {
    if (typeof raw.event !== 'string' || !raw.event) return { valid: false, reason: 'missing event name' };
    if (typeof raw.ts !== 'string' || isNaN(Date.parse(raw.ts))) return { valid: false, reason: 'missing or invalid ts' };
    if (typeof raw.product !== 'string' || !registry.products.includes(raw.product)) {
        return { valid: false, reason: `unknown product: ${String(raw.product)}` };
    }
    if (raw.account_id !== null && raw.account_id !== undefined && typeof raw.account_id !== 'string') {
        return { valid: false, reason: 'account_id must be a string or null' };
    }
    if (raw.device_id !== null && raw.device_id !== undefined && typeof raw.device_id !== 'string') {
        return { valid: false, reason: 'device_id must be a string or null' };
    }
    if (raw.event_id !== null && raw.event_id !== undefined && typeof raw.event_id !== 'string') {
        return { valid: false, reason: 'event_id must be a string or null' };
    }
    // O-260817-13: a device without an account may send device_id alone.
    if (!raw.account_id && !raw.device_id) {
        return { valid: false, reason: 'missing account_id and device_id — at least one is required' };
    }
    if (typeof raw.schema_version !== 'number') return { valid: false, reason: 'missing schema_version' };
    if (raw.props !== undefined && (typeof raw.props !== 'object' || raw.props === null || Array.isArray(raw.props))) {
        return { valid: false, reason: 'props must be an object' };
    }

    const def = registry.events[raw.event];
    if (!def) return { valid: false, reason: `unknown event: ${raw.event}` };
    const allowedProducts = eventProducts(def);
    if (!allowedProducts.includes(raw.product)) {
        return { valid: false, reason: `event ${raw.event} belongs to product ${allowedProducts.join(', ')}, not ${raw.product}` };
    }

    const props = (raw.props ?? {}) as Record<string, unknown>;
    const allowedKeys = new Set([...(def.required ?? []), ...(def.optional ?? [])]);
    for (const key of Object.keys(props)) {
        if (!allowedKeys.has(key)) return { valid: false, reason: `unexpected prop: ${key}` };
    }
    for (const key of def.required ?? []) {
        if (!(key in props)) return { valid: false, reason: `missing required prop: ${key}` };
    }
    if (def.props) {
        for (const [key, expectedType] of Object.entries(def.props)) {
            if (key in props && typeof props[key] !== expectedType) {
                return { valid: false, reason: `prop ${key} must be ${expectedType}` };
            }
        }
    }

    // Проверка перечислений — ПОСЛЕ проверки типов выше, иначе значение
    // неверного типа отвечало бы "не в списке" вместо "не тот тип".
    if (def.values) {
        for (const [key, allowed] of Object.entries(def.values)) {
            if (key in props && !allowed.includes(props[key] as string)) {
                return { valid: false, reason: `prop ${key} must be one of: ${allowed.join(', ')}` };
            }
        }
    }

    if (def.range) {
        for (const [key, [min, max]] of Object.entries(def.range)) {
            if (key in props) {
                const value = props[key] as number;
                if (!Number.isInteger(value) || value < min || value > max) {
                    return { valid: false, reason: `prop ${key} must be an integer between ${min} and ${max}` };
                }
            }
        }
    }

    return { valid: true };
}
