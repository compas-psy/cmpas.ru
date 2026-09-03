// Task 9 (PRAKTIKA MVP) — cron safety: node-cron (src/instrumentation.ts)
// has no built-in overlap protection. If a job's own run takes longer than
// its schedule interval — e.g. processReminders working through many
// sessions over a slow Telegram/MAX network call — the next tick fires
// while the previous one is still reading/writing the same rows
// (notified24h, postSessionNudged, ...). Both runs can read the same
// "not yet notified" session before either writes it back, sending the
// same client message twice.
//
// This wraps a cron job body so a new tick is SKIPPED (not queued) while
// the previous run of the SAME job is still in flight — a simple, per-
// process re-entrancy guard. It does not need to be, and isn't, a
// cross-process lock: this app runs as a single Node process per the
// project's stack (Docker Compose on one VPS — see CLAUDE.md), so a
// process-local guard is exactly the boundary "cron safety" needs here.

export function runExclusive(name: string, fn: () => Promise<void>): () => Promise<void> {
    let running = false;
    return async () => {
        if (running) {
            console.warn(`[CRON] ${name}: предыдущий запуск ещё выполняется — пропускаем этот тик`);
            return;
        }
        running = true;
        try {
            await fn();
        } finally {
            running = false;
        }
    };
}
