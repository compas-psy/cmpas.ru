// Orchestrates one collection tick (O-260817-12). Every category degrades
// independently to `null` on its own failure — one bad reading (say, the
// docker socket hiccups) must not blank out the whole row, since the other
// numbers are still true and still worth having.

import { readFileSync, statfsSync } from 'fs';
import type { Prisma, PrismaClient } from '@prisma/client';
import { cpuPercentBetween, diskStatsFromStatfs, parseProcMeminfo, parseProcStatCpuLine } from './server-stats';
import { collectContainerHealth } from './docker-client';
import { collectDbStats, diffMigrations, readRepoMigrationNames } from './db-stats';
import { listBackupFiles, summarizeBackups } from './backup-stats';
import { collectReminderCounters } from './reminders-counters';
import { certDaysLeft } from './cert';
import { readInfraCost } from './infra-cost';
import { readPaymentFailureRate } from './webhook-error-rate';
import { readBuildMinutesLeft, type BuildMinutesConfig } from './build-minutes';

type Db = Pick<PrismaClient, '$queryRaw' | '$executeRaw' | 'infraPulse' | 'payment' | 'systemConfig'>;

export interface CollectorConfig {
    procRoot: string; // e.g. "/hostfs/proc" — read-only host mount
    diskPath: string; // e.g. "/hostfs/backups" — statfs'd for total/free; same mount as backupDir, see docker-compose.yml
    dockerSocketPath: string; // e.g. "/var/run/docker.sock" — read-only bind mount
    backupDir: string; // e.g. "/hostfs/backups" — read-only host mount, same one used for diskPath
    migrationsDir: string; // this image's own prisma/migrations — no extra grant
    certHostnames: { primary: string; secondaryLabel: 'zapiski'; secondary: string | null };
    retentionDays: number;
    // Остаток минут GitHub Actions (buildMinutesLeft, ТЗ §6.1). Без токена —
    // не выдумываем доступа, поле остаётся null (см. build-minutes.ts).
    githubActions: BuildMinutesConfig;
}

export const DEFAULT_RETENTION_DAYS = 90;

async function readServerStats(config: CollectorConfig) {
    try {
        const statPath = `${config.procRoot}/stat`;
        const a = parseProcStatCpuLine(readFileSync(statPath, 'utf8').split('\n')[0] ?? '');
        await new Promise((resolve) => setTimeout(resolve, 200));
        const b = parseProcStatCpuLine(readFileSync(statPath, 'utf8').split('\n')[0] ?? '');
        const cpuPercent = cpuPercentBetween(a, b);

        const mem = parseProcMeminfo(readFileSync(`${config.procRoot}/meminfo`, 'utf8'));

        const statfs = statfsSync(config.diskPath);
        const disk = diskStatsFromStatfs(statfs);

        return {
            cpuPercent,
            memUsedBytes: mem ? BigInt(mem.usedBytes) : null,
            memTotalBytes: mem ? BigInt(mem.totalBytes) : null,
            diskUsedBytes: BigInt(disk.usedBytes),
            diskTotalBytes: BigInt(disk.totalBytes),
        };
    } catch (error) {
        console.error('[infra-pulse] server stats failed:', error);
        return { cpuPercent: null, memUsedBytes: null, memTotalBytes: null, diskUsedBytes: null, diskTotalBytes: null };
    }
}

async function readContainers(config: CollectorConfig) {
    try {
        return await collectContainerHealth(config.dockerSocketPath);
    } catch (error) {
        console.error('[infra-pulse] container stats failed:', error);
        return null;
    }
}

async function readDb(db: Db, config: CollectorConfig) {
    try {
        const stats = await collectDbStats(db);
        const repoNames = readRepoMigrationNames(config.migrationsDir);
        const drift = diffMigrations(repoNames, stats.appliedMigrationNames);
        return { stats, drift };
    } catch (error) {
        console.error('[infra-pulse] db stats failed:', error);
        return null;
    }
}

async function readBackups(config: CollectorConfig) {
    try {
        const files = listBackupFiles(config.backupDir);
        return summarizeBackups(files);
    } catch (error) {
        console.error('[infra-pulse] backup stats failed:', error);
        return null;
    }
}

async function readReminders(db: Db) {
    try {
        return await collectReminderCounters(db);
    } catch (error) {
        console.error('[infra-pulse] reminder counters failed:', error);
        return null;
    }
}

async function readCerts(config: CollectorConfig) {
    const primary = await certDaysLeft(config.certHostnames.primary).catch(() => null);
    const secondary = config.certHostnames.secondary ? await certDaysLeft(config.certHostnames.secondary).catch(() => null) : null;
    return { primary, secondary };
}

async function readInfraCostSafe(db: Db) {
    try {
        return await readInfraCost(db);
    } catch (error) {
        console.error('[infra-pulse] infra cost read failed:', error);
        return null;
    }
}

async function readWebhookErrorRatesSafe(db: Db) {
    try {
        return await readPaymentFailureRate(db);
    } catch (error) {
        console.error('[infra-pulse] webhook error rate failed:', error);
        return null;
    }
}

async function readBuildMinutesSafe(config: CollectorConfig) {
    try {
        return await readBuildMinutesLeft(config.githubActions);
    } catch (error) {
        console.error('[infra-pulse] github actions billing read failed:', error);
        return null;
    }
}

export async function collectOnce(db: Db, config: CollectorConfig): Promise<Prisma.InfraPulseCreateInput> {
    const [server, containers, dbResult, backups, reminders, certs, infraCost, webhookRate, buildMinutesLeft] = await Promise.all([
        readServerStats(config),
        readContainers(config),
        readDb(db, config),
        readBackups(config),
        readReminders(db),
        readCerts(config),
        readInfraCostSafe(db),
        readWebhookErrorRatesSafe(db),
        readBuildMinutesSafe(config),
    ]);

    return {
        cpuPercent: server.cpuPercent,
        memUsedBytes: server.memUsedBytes,
        memTotalBytes: server.memTotalBytes,
        diskUsedBytes: server.diskUsedBytes,
        diskTotalBytes: server.diskTotalBytes,
        containers: containers ? (containers as unknown as Prisma.InputJsonValue) : undefined,
        dbSizeBytes: dbResult ? BigInt(dbResult.stats.sizeBytes) : null,
        dbTopTables: dbResult ? (dbResult.stats.topTables as unknown as Prisma.InputJsonValue) : undefined,
        dbRowCounts: dbResult ? (dbResult.stats.rowCounts as unknown as Prisma.InputJsonValue) : undefined,
        migrationsApplied: dbResult?.stats.migrationsApplied ?? null,
        migrationsUnfinished: dbResult?.stats.migrationsUnfinished ?? null,
        migrationsDrift: dbResult ? (dbResult.drift as unknown as Prisma.InputJsonValue) : undefined,
        backupAgeHours: backups?.ageHours ?? null,
        backupSizeBytes: backups ? BigInt(backups.sizeBytes) : null,
        backupSizeRatioYesterday: backups?.sizeRatioYesterday ?? null,
        backupReadable: backups?.readable ?? null,
        remindersDue: reminders?.due ?? null,
        remindersSent: reminders?.sent ?? null,
        remindersSentTwice: reminders?.sentTwice ?? null,
        certDaysLeft: certs.primary,
        certDaysLeftZapiski: certs.secondary,
        // Три поля ниже были объявлены в схеме (миграция 20260820120000) и
        // ни разу не заполнялись — collectOnce их просто не считал. См.
        // src/lib/infra-pulse/infra-cost.ts, webhook-error-rate.ts,
        // build-minutes.ts за источником и honesty-ограничениями каждого.
        infraCostRub: infraCost ? (infraCost as unknown as Prisma.InputJsonValue) : undefined,
        webhookErrorRates: webhookRate ? ({ payments: webhookRate } as unknown as Prisma.InputJsonValue) : undefined,
        buildMinutesLeft: buildMinutesLeft,
    };
}

export async function pruneOldRows(db: Pick<PrismaClient, '$executeRaw'>, retentionDays: number, now: Date = new Date()): Promise<number> {
    const cutoff = new Date(now.getTime() - retentionDays * 24 * 60 * 60 * 1000);
    const deleted = await db.$executeRaw`DELETE FROM "InfraPulse" WHERE "collectedAt" < ${cutoff}`;
    return Number(deleted);
}

/** One full tick: collect, persist, prune — what the standalone worker calls on its own schedule. */
export async function runCollectorOnce(db: Db, config: CollectorConfig): Promise<void> {
    const reading = await collectOnce(db, config);
    await db.infraPulse.create({ data: reading });
    await pruneOldRows(db, config.retentionDays);
}
