// O-260817-17: the central registry (analytics/schema/events.yaml) must be a
// superset of ЗАПИСКИ's and МОМЕНТОВ's own client-side registries — checked
// here, not by eye. This repo's CI does not check out the zapiski or
// compas-voice repos, so a live cross-repo diff isn't possible from inside a
// single-repo test; instead this file pins a snapshot of what those repos
// declared on 18.08.2026 (zapiski: packages/core/src/analytics/schema.ts,
// compas-voice: android/app/src/main/java/ru/cmpas/voice/analytics/AnalyticsSchema.kt)
// and fails if the central registry drifts from it. Whoever changes an event
// name or prop set in either product repo must update the matching snapshot
// below in the same change — a genuine live check would need multi-repo CI,
// which is out of scope for this order.
//
// E4 (контракт контура v2 п.6): consent_updated and identity_linked are
// added to both product snapshots here even though they are not (yet, as of
// the 18.08.2026 snapshot) declared in either product repo's own schema
// file — this is a receiver-side decision (E1: both events are registered
// under all three products in events.yaml), not something synced FROM the
// product repos. ЗАПИСКИ and МОМЕНТЫ must be able to send them regardless
// of whether their own client-side registry already names them; whoever
// adds them there in the same shape should find this assertion already
// green, not something to now edit.
//
// def.product may be a single string OR a list (multi-product events) —
// the check below is "product is among the allowed ones", not equality;
// a single-product event with a mismatched product still fails it.

import { describe, it, expect } from 'vitest';
import { loadRegistry, eventProducts } from '@/lib/analytics/schema';

const ZAPISKI_SNAPSHOT: Record<string, string[]> = {
    note_saved: ['length_bucket', 'encrypted'],
    note_searched: ['query_length_bucket', 'results_count'],
    sync_completed: ['pushed', 'pulled', 'conflicts'],
    export_requested: ['format', 'notes_count'],
    consent_updated: ['granted'],
    identity_linked: [],
};

const MOMENTS_SNAPSHOT: Record<string, string[]> = {
    app_installed: [],
    practice_started: ['practice_id', 'group', 'is_sleep'],
    practice_finished: ['practice_id', 'group', 'is_sleep', 'completion_pct'],
    crossed_to_product: ['target_product'],
    consent_updated: ['granted'],
    identity_linked: [],
};

function assertSuperset(product: string, snapshot: Record<string, string[]>) {
    const registry = loadRegistry();
    for (const [eventName, props] of Object.entries(snapshot)) {
        const def = registry.events[eventName];
        expect(def, `central registry is missing ${product} event ${eventName}`).toBeDefined();
        expect(eventProducts(def), `${eventName} is not registered for product ${product}`).toContain(product);
        const centralProps = new Set([...def.required, ...def.optional]);
        for (const prop of props) {
            expect(centralProps.has(prop), `central registry is missing prop ${prop} on ${eventName}`).toBe(true);
        }
    }
}

describe('central registry is a superset of product registries (O-260817-17)', () => {
    it('contains every zapiski event and prop from the 18.08.2026 snapshot', () => {
        assertSuperset('zapiski', ZAPISKI_SNAPSHOT);
    });

    it('contains every moments event and prop from the 18.08.2026 snapshot', () => {
        assertSuperset('moments', MOMENTS_SNAPSHOT);
    });
});
