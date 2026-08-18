// Standalone reminders-outbox worker (O-260817-16). Runs as its own process
// — cmpas-reminders-worker in docker-compose.yml, not inside the site — so a
// site restart or deploy no longer means a missed or a doubled reminder.
//
// Usage: npx tsx scripts/reminders-worker.ts
// Poll interval: REMINDERS_POLL_INTERVAL_MS env var, default 60000 (60s).

import { PrismaClient } from '@prisma/client';
import { runOutboxOnce } from '../src/lib/reminders/outbox';

const db = new PrismaClient();
const workerId = `worker-${process.pid}-${Math.random().toString(36).slice(2, 8)}`;
const pollIntervalMs = Number(process.env.REMINDERS_POLL_INTERVAL_MS ?? 60_000);

let stopping = false;

async function tick(): Promise<void> {
    try {
        const result = await runOutboxOnce(db, workerId);
        if (result.claimed > 0) {
            console.log(`[reminders-worker] claimed=${result.claimed} sent=${result.sent} failed=${result.failed}`);
        }
    } catch (error) {
        console.error('[reminders-worker] tick failed:', error);
    }
}

async function loop(): Promise<void> {
    while (!stopping) {
        await tick();
        await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    }
}

async function shutdown(signal: string): Promise<void> {
    console.log(`[reminders-worker] ${signal} received, shutting down`);
    stopping = true;
    await db.$disconnect();
    process.exit(0);
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

console.log(`[reminders-worker] starting worker=${workerId} pollIntervalMs=${pollIntervalMs}`);
void loop();
