// Flood guard for POST /ingest, keyed by device_id (O-260817-13: "ограничение
// частоты по deviceId, чтобы приёмник нельзя было залить"). In-memory and
// per-process — the goal is to blunt one client hammering the endpoint, not
// to be an exact limit under horizontal scaling.

const WINDOW_MS = 60_000;
const MAX_HITS_PER_WINDOW = 60;

export const defaultRateLimitStore = new Map<string, number[]>();

export function isRateLimited(
    deviceId: string,
    now: number,
    store: Map<string, number[]> = defaultRateLimitStore,
): boolean {
    const cutoff = now - WINDOW_MS;
    const hits = (store.get(deviceId) ?? []).filter((hit) => hit > cutoff);
    hits.push(now);
    store.set(deviceId, hits);
    return hits.length > MAX_HITS_PER_WINDOW;
}
