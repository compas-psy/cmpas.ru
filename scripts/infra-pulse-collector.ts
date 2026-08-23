// Standalone infra-pulse collector (O-260817-12). Own process, own
// container — cmpas-infra-pulse in docker-compose.yml, not inside the site.
// Connects with a SELECT-only DB role (docker/infra-pulse-role.sh grants it
// nothing else, except INSERT/DELETE scoped to InfraPulse itself — its own
// output table, not application data) and a read-only docker socket mount.
//
// Usage: npx tsx scripts/infra-pulse-collector.ts
// Poll interval: INFRA_PULSE_INTERVAL_MS env var, default 300000 (5 min).

import { PrismaClient } from '@prisma/client';
import { runCollectorOnce, DEFAULT_RETENTION_DAYS, type CollectorConfig } from '../src/lib/infra-pulse/collector';

const db = new PrismaClient();
const intervalMs = Number(process.env.INFRA_PULSE_INTERVAL_MS ?? 300_000);

// Two narrow, purpose-specific read-only host mounts (docker-compose.yml),
// not a blanket "/:/hostfs:ro" — /proc for CPU/memory, and the backups
// directory both for the backups card itself AND as the statfs target for
// disk usage (it lives on the same root filesystem as everything else on
// this single-disk VPS, so its statfs is representative of the host disk
// without needing to bind-mount the whole tree just to read one number).
const config: CollectorConfig = {
    procRoot: process.env.INFRA_PULSE_PROC_ROOT ?? '/hostfs/proc',
    diskPath: process.env.INFRA_PULSE_DISK_PATH ?? '/hostfs/backups',
    dockerSocketPath: process.env.INFRA_PULSE_DOCKER_SOCKET ?? '/var/run/docker.sock',
    backupDir: process.env.INFRA_PULSE_BACKUP_DIR ?? '/hostfs/backups',
    migrationsDir: process.env.INFRA_PULSE_MIGRATIONS_DIR ?? new URL('../prisma/migrations', import.meta.url).pathname,
    certHostnames: {
        primary: process.env.INFRA_PULSE_CERT_HOST ?? 'cmpas.ru',
        secondaryLabel: 'zapiski',
        secondary: process.env.INFRA_PULSE_CERT_HOST_ZAPISKI || null,
    },
    retentionDays: DEFAULT_RETENTION_DAYS,
    // Оба опциональны — без них buildMinutesLeft честно остаётся null,
    // сетевой запрос к GitHub не делается (build-minutes.ts).
    githubActions: {
        token: process.env.INFRA_PULSE_GITHUB_TOKEN || null,
        org: process.env.INFRA_PULSE_GITHUB_ORG || null,
    },
};

let stopping = false;

async function tick(): Promise<void> {
    try {
        await runCollectorOnce(db, config);
    } catch (error) {
        console.error('[infra-pulse] tick failed:', error);
    }
}

async function loop(): Promise<void> {
    while (!stopping) {
        await tick();
        await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
}

async function shutdown(signal: string): Promise<void> {
    console.log(`[infra-pulse] ${signal} received, shutting down`);
    stopping = true;
    await db.$disconnect();
    process.exit(0);
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

console.log(`[infra-pulse] starting, intervalMs=${intervalMs}`);
void loop();
