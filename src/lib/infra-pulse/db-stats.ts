// Database card (O-260817-12): size, top tables, row counts in the tables
// that matter for a sanity check, migration journal state, and the drift
// between what's on disk in this image (prisma/migrations/*) and what
// `_prisma_migrations` says was actually applied — the exact gap that broke
// deploys on 17.08.2026 unnoticed for months (product/dashboard/DATA_GAP.md).
//
// Everything here is a plain SELECT — the collector's DB role has no grant
// beyond that (docker/infra-pulse-role.sh).

import { readdirSync } from 'fs';
import { Prisma, type PrismaClient } from '@prisma/client';

type Db = Pick<PrismaClient, '$queryRaw'>;

export interface TopTable {
    name: string;
    bytes: number;
}

export interface DbStats {
    sizeBytes: number;
    topTables: TopTable[];
    rowCounts: Record<string, number>;
    migrationsApplied: number;
    migrationsUnfinished: number;
    appliedMigrationNames: string[];
}

const ROW_COUNT_TABLES = ['User', 'DiaryClient', 'DiarySession', 'Payment'] as const;

export async function collectDbStats(db: Db): Promise<DbStats> {
    const [sizeRows, topRows, migrationRows, ...rowCountRows] = await Promise.all([
        db.$queryRaw<{ bytes: bigint }[]>`SELECT pg_database_size(current_database()) AS bytes`,
        db.$queryRaw<{ name: string; bytes: bigint }[]>`
            SELECT relname AS name, pg_total_relation_size(c.oid) AS bytes
            FROM pg_class c
            JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE c.relkind = 'r' AND n.nspname = 'public'
            ORDER BY bytes DESC
            LIMIT 5
        `,
        db.$queryRaw<{ applied: bigint; unfinished: bigint }[]>`
            SELECT
                count(*) AS applied,
                count(*) FILTER (WHERE finished_at IS NULL AND rolled_back_at IS NULL) AS unfinished
            FROM _prisma_migrations
        `,
        ...ROW_COUNT_TABLES.map((table) =>
            db.$queryRaw<{ count: bigint }[]>(Prisma.sql`SELECT count(*) AS count FROM ${Prisma.raw(`"${table}"`)}`)
        ),
    ]);

    const appliedNames = await db.$queryRaw<{ migration_name: string }[]>`SELECT migration_name FROM _prisma_migrations ORDER BY started_at ASC`;

    const rowCounts: Record<string, number> = {};
    ROW_COUNT_TABLES.forEach((table, i) => {
        rowCounts[table] = Number(rowCountRows[i]?.[0]?.count ?? BigInt(0));
    });

    return {
        sizeBytes: Number(sizeRows[0]?.bytes ?? BigInt(0)),
        topTables: topRows.map((r) => ({ name: r.name, bytes: Number(r.bytes) })),
        rowCounts,
        migrationsApplied: Number(migrationRows[0]?.applied ?? BigInt(0)),
        migrationsUnfinished: Number(migrationRows[0]?.unfinished ?? BigInt(0)),
        appliedMigrationNames: appliedNames.map((r) => r.migration_name),
    };
}

export interface MigrationDrift {
    onlyInRepo: string[];
    onlyInDb: string[];
}

/** Pure diff — testable without touching the filesystem or a database. */
export function diffMigrations(repoNames: readonly string[], dbNames: readonly string[]): MigrationDrift {
    const dbSet = new Set(dbNames);
    const repoSet = new Set(repoNames);
    return {
        onlyInRepo: repoNames.filter((n) => !dbSet.has(n)),
        onlyInDb: dbNames.filter((n) => !repoSet.has(n)),
    };
}

/** Migration folder names shipped inside the collector's own image — same repo, same build. */
export function readRepoMigrationNames(migrationsDir: string): string[] {
    return readdirSync(migrationsDir, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .sort();
}
