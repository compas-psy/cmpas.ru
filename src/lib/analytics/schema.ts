// Validates events against analytics/schema/events.yaml before POST /ingest
// writes anything (charter/12_ANALYTICS.md §3). Unknown event names, unknown
// products, or props not declared for that event are rejected — never
// silently accepted, and never silently dropped either (the caller decides
// what to do with a rejection, this module only judges).

import fs from 'fs';
import path from 'path';
import { load } from 'js-yaml';

export interface EventDef {
    question?: string;
    required: string[];
    optional: string[];
    props?: Record<string, 'string' | 'number' | 'boolean'>;
}

export interface EventRegistry {
    version: number;
    products: string[];
    events: Record<string, EventDef>;
}

let cached: EventRegistry | null = null;

// charter/12_ANALYTICS.md, правило 3: «событие без вопроса не заводится».
// A registry event with no `question` fails to load rather than being
// silently accepted — the same shape of guarantee `validateEvent` gives
// per-request, applied to the registry file itself.
export function assertEventsHaveQuestions(events: Record<string, EventDef>): void {
    for (const [name, def] of Object.entries(events)) {
        if (typeof def.question !== 'string' || !def.question.trim()) {
            throw new Error(`analytics/schema/events.yaml: event "${name}" is missing a question (charter/12_ANALYTICS.md, правило 3)`);
        }
    }
}

export function loadRegistry(): EventRegistry {
    if (!cached) {
        const file = path.join(process.cwd(), 'analytics/schema/events.yaml');
        const parsed = load(fs.readFileSync(file, 'utf8')) as EventRegistry;
        assertEventsHaveQuestions(parsed.events);
        cached = parsed;
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
