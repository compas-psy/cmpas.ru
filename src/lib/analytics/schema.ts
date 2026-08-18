// Validates events against analytics/schema/events.yaml before POST /ingest
// writes anything (charter/12_ANALYTICS.md §3). Unknown event names, unknown
// products, or props not declared for that event are rejected — never
// silently accepted, and never silently dropped either (the caller decides
// what to do with a rejection, this module only judges).
//
// O-260817-17: every event belongs to exactly one product (the registry's
// `products` list is who may call /ingest at all, `events.<name>.product` is
// which of them owns that specific event name) — an event submitted under a
// product it doesn't belong to is rejected the same as an unknown event.

import fs from 'fs';
import path from 'path';
import { load } from 'js-yaml';

export interface EventDef {
    product: string;
    required: string[];
    optional: string[];
    props?: Record<string, 'string' | 'number' | 'boolean'>;
    question?: string;
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
}

export type ValidationResult = { valid: true } | { valid: false; reason: string };

export function validateEvent(raw: RawEvent, registry: EventRegistry = loadRegistry()): ValidationResult {
    if (typeof raw.event !== 'string' || !raw.event) return { valid: false, reason: 'missing event name' };
    if (typeof raw.ts !== 'string' || isNaN(Date.parse(raw.ts))) return { valid: false, reason: 'missing or invalid ts' };
    if (typeof raw.product !== 'string' || !registry.products.includes(raw.product)) {
        return { valid: false, reason: `unknown product: ${String(raw.product)}` };
    }
    if (typeof raw.account_id !== 'string' || !raw.account_id) return { valid: false, reason: 'missing account_id' };
    if (raw.device_id !== null && raw.device_id !== undefined && typeof raw.device_id !== 'string') {
        return { valid: false, reason: 'device_id must be a string or null' };
    }
    if (typeof raw.schema_version !== 'number') return { valid: false, reason: 'missing schema_version' };
    if (raw.props !== undefined && (typeof raw.props !== 'object' || raw.props === null || Array.isArray(raw.props))) {
        return { valid: false, reason: 'props must be an object' };
    }

    const def = registry.events[raw.event];
    if (!def) return { valid: false, reason: `unknown event: ${raw.event}` };
    if (def.product !== raw.product) {
        return { valid: false, reason: `event ${raw.event} belongs to product ${def.product}, not ${raw.product}` };
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

    return { valid: true };
}
