// Backups card (O-260817-12). Reads the same host directory that
// deploy-production-remote.sh and .github/workflows/backup-db.yml already
// write to (/var/backups/cmpas) — mounted read-only into the collector, the
// same extra grant used for disk usage, not a new one. No restore is
// attempted here beyond `pg_restore --list` on a .dump file, which reads
// the archive's table of contents without touching a database.
//
// "Дней с последнего учебного восстановления" has no data source anywhere
// in the org yet (product/dashboard/TZ_management_dashboard.md: "сегодня
// это число — «никогда»") — this module does not compute it; the row is
// left without that field until a restore-drill process starts logging
// something.

import { readdirSync, readFileSync, statSync } from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';

export interface BackupFile {
    path: string;
    mtimeMs: number;
    sizeBytes: number;
    kind: 'dump' | 'sql';
}

const DUMP_RE = /^cmpas_db_.*\.dump$/;
const SQL_RE = /^db_backup_.*\.sql$/;

/** Both backup mechanisms' naming conventions, newest first. */
export function listBackupFiles(dir: string): BackupFile[] {
    let entries: string[];
    try {
        entries = readdirSync(dir);
    } catch {
        return [];
    }
    const files: BackupFile[] = [];
    for (const name of entries) {
        const kind = DUMP_RE.test(name) ? 'dump' : SQL_RE.test(name) ? 'sql' : null;
        if (!kind) continue;
        const full = path.join(dir, name);
        const stat = statSync(full);
        files.push({ path: full, mtimeMs: stat.mtimeMs, sizeBytes: stat.size, kind });
    }
    return files.sort((a, b) => b.mtimeMs - a.mtimeMs);
}

export interface BackupSummary {
    ageHours: number;
    sizeBytes: number;
    sizeRatioYesterday: number | null;
    readable: boolean;
}

/** Nearest older file to ~24h before `latest`, within a ±6h window — "yesterday's backup", not necessarily the very next file in the list. */
export function findYesterdayBackup(files: readonly BackupFile[], latest: BackupFile): BackupFile | null {
    const targetAge = latest.mtimeMs - 24 * 60 * 60 * 1000;
    const window = 6 * 60 * 60 * 1000;
    let best: BackupFile | null = null;
    let bestDelta = Infinity;
    for (const file of files) {
        if (file.path === latest.path) continue;
        const delta = Math.abs(file.mtimeMs - targetAge);
        if (delta < window && delta < bestDelta) {
            best = file;
            bestDelta = delta;
        }
    }
    return best;
}

function isReadableSqlDump(filePath: string): boolean {
    try {
        const bytes = readFileSync(filePath);
        if (bytes.length === 0) return false;
        const text = bytes.toString('utf8');
        return text.includes('PostgreSQL database dump') && text.includes('PostgreSQL database dump complete');
    } catch {
        return false;
    }
}

function isReadableCustomDump(filePath: string): boolean {
    try {
        execFileSync('pg_restore', ['--list', filePath], { stdio: ['ignore', 'ignore', 'ignore'], timeout: 30_000 });
        return true;
    } catch {
        return false;
    }
}

export function summarizeBackups(files: readonly BackupFile[], now: Date = new Date()): BackupSummary | null {
    const latest = files[0];
    if (!latest) return null;
    const yesterday = findYesterdayBackup(files, latest);
    return {
        ageHours: (now.getTime() - latest.mtimeMs) / (60 * 60 * 1000),
        sizeBytes: latest.sizeBytes,
        sizeRatioYesterday: yesterday && yesterday.sizeBytes > 0 ? latest.sizeBytes / yesterday.sizeBytes : null,
        readable: latest.kind === 'dump' ? isReadableCustomDump(latest.path) : isReadableSqlDump(latest.path),
    };
}
