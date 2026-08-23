// Flood guard for POST /ingest, keyed by subject (E3, контракт контура v2
// п.7 — the same subject key ingest.ts gates consent on:
// subjectKeyFor(product, account_id, device_id), so an account_id-only
// submission with no device_id is limited too, and two device_ids under the
// same account don't get an independent budget each). In-memory and
// per-process — the goal is to blunt one client hammering the endpoint, not
// to be an exact limit under horizontal scaling.
//
// O-260817-13 originally set this to 60/60s keyed by raw device_id; E3
// raised it to 600/60s because a legitimate 200-event batch (MAX_INGEST_
// BATCH_SIZE) from one subject tripped the old limit past its fourth dozen.

const WINDOW_MS = 60_000;
const MAX_HITS_PER_WINDOW = 600;

export const defaultRateLimitStore = new Map<string, number[]>();

export function isRateLimited(
    subjectKey: string,
    now: number,
    store: Map<string, number[]> = defaultRateLimitStore,
): boolean {
    const cutoff = now - WINDOW_MS;
    const hits = (store.get(subjectKey) ?? []).filter((hit) => hit > cutoff);
    hits.push(now);
    store.set(subjectKey, hits);
    return hits.length > MAX_HITS_PER_WINDOW;
}
