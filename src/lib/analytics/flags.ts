// Feature flags for analytics F0/F1 (charter/13_TRACKING_PLAN.md, charter/12_ANALYTICS.md).
// Both default to disabled — CLAUDE.md §5.2 / устав §6.1: new functionality
// ships behind a flag that's off until a human turns it on.

export function isTrackingEnabled(): boolean {
    return process.env.ANALYTICS_TRACKING_ENABLED === 'true';
}

export function isIngestEnabled(): boolean {
    return process.env.ANALYTICS_INGEST_ENABLED === 'true';
}
