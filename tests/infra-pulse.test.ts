import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, utimesSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';

import {
    parseProcStatCpuLine,
    cpuPercentBetween,
    parseProcMeminfo,
    diskStatsFromStatfs,
} from '@/lib/infra-pulse/server-stats';
import { parseDockerEventsNdjson } from '@/lib/infra-pulse/docker-client';
import { diffMigrations } from '@/lib/infra-pulse/db-stats';
import { listBackupFiles, findYesterdayBackup, summarizeBackups } from '@/lib/infra-pulse/backup-stats';
import { daysUntil } from '@/lib/infra-pulse/cert';
import { collectReminderCounters } from '@/lib/infra-pulse/reminders-counters';
import { parseInfraCostConfigValue, readInfraCost } from '@/lib/infra-pulse/infra-cost';
import { computePaymentFailureRate, readPaymentFailureRate } from '@/lib/infra-pulse/webhook-error-rate';
import { readBuildMinutesLeft } from '@/lib/infra-pulse/build-minutes';
import { collectOnce, type CollectorConfig } from '@/lib/infra-pulse/collector';

describe('server-stats (O-260817-12)', () => {
    it('parses the cpu line of /proc/stat', () => {
        const line = 'cpu  100 0 50 800 10 0 0 0 0 0';
        const sample = parseProcStatCpuLine(line);
        expect(sample.total).toBe(100 + 0 + 50 + 800 + 10);
        expect(sample.idle).toBe(800 + 10);
    });

    it('computes cpu% busy between two cumulative samples', () => {
        const a = parseProcStatCpuLine('cpu  100 0 50 800 10 0 0 0 0 0');
        const b = parseProcStatCpuLine('cpu  120 0 60 810 10 0 0 0 0 0'); // +30 busy, +10 idle, +40 total
        const pct = cpuPercentBetween(a, b);
        expect(pct).not.toBeNull();
        expect(pct!).toBeCloseTo(75, 5); // 30 busy of 40 total = 75%
    });

    it('returns null when the two samples did not advance (no time actually passed)', () => {
        const a = parseProcStatCpuLine('cpu  100 0 50 800 10 0 0 0 0 0');
        expect(cpuPercentBetween(a, a)).toBeNull();
    });

    it('parses MemTotal/MemAvailable from /proc/meminfo', () => {
        const text = 'MemTotal:       16384000 kB\nMemFree:         1000000 kB\nMemAvailable:    8000000 kB\n';
        const mem = parseProcMeminfo(text);
        expect(mem).toEqual({ totalBytes: 16384000 * 1024, usedBytes: (16384000 - 8000000) * 1024 });
    });

    it('returns null when meminfo is missing the fields it needs', () => {
        expect(parseProcMeminfo('garbage\n')).toBeNull();
    });

    it('computes disk used/total from a statfs-shaped object', () => {
        const disk = diskStatsFromStatfs({ bsize: 4096, blocks: 1000, bfree: 400 });
        expect(disk.totalBytes).toBe(4096 * 1000);
        expect(disk.usedBytes).toBe(4096 * 600);
    });
});

describe('parseDockerEventsNdjson (O-260817-12)', () => {
    it('counts newline-delimited JSON event objects', () => {
        const body = '{"Action":"restart"}\n{"Action":"restart"}\n{"Action":"restart"}\n';
        expect(parseDockerEventsNdjson(body)).toBe(3);
    });

    it('returns 0 for an empty body (no events in range)', () => {
        expect(parseDockerEventsNdjson('')).toBe(0);
        expect(parseDockerEventsNdjson('\n')).toBe(0);
    });
});

describe('diffMigrations (O-260817-12, the "расхождение" that broke deploys on 17.08.2026)', () => {
    it('is empty when repo and db agree', () => {
        const drift = diffMigrations(['0001_a', '0002_b'], ['0001_a', '0002_b']);
        expect(drift).toEqual({ onlyInRepo: [], onlyInDb: [] });
    });

    it('flags a migration present on disk but never applied to the db', () => {
        const drift = diffMigrations(['0001_a', '0002_b'], ['0001_a']);
        expect(drift.onlyInRepo).toEqual(['0002_b']);
        expect(drift.onlyInDb).toEqual([]);
    });

    it('flags a migration recorded in the db but missing from the checked-out repo (the exact incident)', () => {
        const drift = diffMigrations(['0001_a'], ['0001_a', '0002_ghost']);
        expect(drift.onlyInDb).toEqual(['0002_ghost']);
        expect(drift.onlyInRepo).toEqual([]);
    });
});

describe('backup-stats (O-260817-12)', () => {
    let dir: string;

    beforeEach(() => {
        dir = mkdtempSync(path.join(tmpdir(), 'infra-pulse-backups-'));
    });

    afterEach(() => {
        rmSync(dir, { recursive: true, force: true });
    });

    function writeBackup(name: string, content: string, ageHoursAgo: number) {
        const file = path.join(dir, name);
        writeFileSync(file, content);
        const t = new Date(Date.now() - ageHoursAgo * 60 * 60 * 1000);
        utimesSync(file, t, t);
        return file;
    }

    it('lists only files matching the two known backup naming conventions', () => {
        writeBackup('db_backup_20260818_090000.sql', 'x', 1);
        writeBackup('cmpas_db_20260818.dump', 'x', 1);
        writeBackup('random-other-file.txt', 'x', 1);
        const files = listBackupFiles(dir);
        expect(files.map((f) => path.basename(f.path)).sort()).toEqual(['cmpas_db_20260818.dump', 'db_backup_20260818_090000.sql']);
    });

    it('returns an empty list when the directory does not exist (mount not present yet)', () => {
        expect(listBackupFiles(path.join(dir, 'nope'))).toEqual([]);
    });

    it('finds the backup closest to 24h before the latest one as "yesterday"', () => {
        writeBackup('db_backup_3.sql', 'x', 0); // latest
        const yesterdayFile = writeBackup('db_backup_2.sql', 'x', 24); // ~24h old — this is "yesterday"
        writeBackup('db_backup_1.sql', 'x', 48); // too old to be "yesterday"
        const files = listBackupFiles(dir);
        const latest = files[0]!;
        const yesterday = findYesterdayBackup(files, latest);
        expect(yesterday?.path).toBe(yesterdayFile);
    });

    it('a well-formed plain SQL dump is readable', () => {
        writeBackup(
            'db_backup_1.sql',
            '-- PostgreSQL database dump\n...\n-- PostgreSQL database dump complete\n',
            1
        );
        const summary = summarizeBackups(listBackupFiles(dir));
        expect(summary?.readable).toBe(true);
    });

    it('a truncated/corrupt SQL dump (missing the completion trailer) is not readable', () => {
        writeBackup('db_backup_1.sql', '-- PostgreSQL database dump\n...only half of it', 1);
        const summary = summarizeBackups(listBackupFiles(dir));
        expect(summary?.readable).toBe(false);
    });

    it('computes age in hours and the size ratio against yesterday', () => {
        writeBackup('db_backup_2.sql', 'a'.repeat(200), 24);
        writeBackup('db_backup_1.sql', 'a'.repeat(100), 1);
        const summary = summarizeBackups(listBackupFiles(dir));
        expect(summary?.ageHours).toBeGreaterThan(0.9);
        expect(summary?.ageHours).toBeLessThan(1.1);
        expect(summary?.sizeRatioYesterday).toBeCloseTo(100 / 200, 5);
    });

    it('returns null when there is nothing to summarize', () => {
        expect(summarizeBackups([])).toBeNull();
    });
});

describe('collectReminderCounters (O-260817-12, feeds off ReminderOutbox from O-260817-16)', () => {
    it('returns null when ReminderOutbox does not exist yet — decoupled from that migration landing first', async () => {
        const queryRaw = vi.fn().mockResolvedValueOnce([{ exists: false }]);
        const result = await collectReminderCounters({ $queryRaw: queryRaw } as any);
        expect(result).toBeNull();
        expect(queryRaw).toHaveBeenCalledTimes(1); // never queries the table it just confirmed doesn't exist
    });

    it('computes due/sent/sentTwice once the table exists', async () => {
        const queryRaw = vi
            .fn()
            .mockResolvedValueOnce([{ exists: true }])
            .mockResolvedValueOnce([{ due: BigInt(5), sent: BigInt(3), sent_twice: BigInt(1) }]);
        const result = await collectReminderCounters({ $queryRaw: queryRaw } as any);
        expect(result).toEqual({ due: 5, sent: 3, sentTwice: 1 });
    });
});

describe('cert.daysUntil (O-260817-12)', () => {
    it('computes whole days remaining until expiry', () => {
        const now = new Date('2026-08-18T00:00:00Z');
        expect(daysUntil('2026-09-17T00:00:00Z', now)).toBe(30);
    });

    it('is negative once the certificate has already expired', () => {
        const now = new Date('2026-08-18T00:00:00Z');
        expect(daysUntil('2026-08-01T00:00:00Z', now)).toBeLessThan(0);
    });
});

describe('infra-cost (O-260817-12, коллектор наконец заполняет infraCostRub)', () => {
    it('null when SystemConfig has no value for the key yet', () => {
        expect(parseInfraCostConfigValue(undefined)).toBeNull();
        expect(parseInfraCostConfigValue(null)).toBeNull();
    });

    it('null on the sentinel "false" value written for an unset flag-like config', () => {
        expect(parseInfraCostConfigValue('false')).toBeNull();
    });

    it('null on malformed JSON — never throws', () => {
        expect(parseInfraCostConfigValue('{not json')).toBeNull();
    });

    it('parses the shape written by setInfraCost (src/app/admin/panel/actions.ts) and computes total', () => {
        const raw = JSON.stringify({ server: 3000, storage: 500, domains: 200, source: 'manual', updatedAt: '2026-08-18T09:00:00.000Z' });
        expect(parseInfraCostConfigValue(raw)).toEqual({
            server: 3000,
            storage: 500,
            domains: 200,
            total: 3700,
            source: 'manual',
            updatedAt: '2026-08-18T09:00:00.000Z',
        });
    });

    it('a partial entry (only one article filled) still parses, missing ones are null', () => {
        const raw = JSON.stringify({ server: 3000, source: 'manual', updatedAt: '2026-08-18T09:00:00.000Z' });
        const result = parseInfraCostConfigValue(raw);
        expect(result?.storage).toBeNull();
        expect(result?.domains).toBeNull();
        expect(result?.total).toBe(3000);
    });

    it('readInfraCost reads SystemConfig by the exact key the panel writes to', async () => {
        const findUnique = vi.fn().mockResolvedValue({ value: JSON.stringify({ server: 100, storage: 0, domains: 0 }) });
        const result = await readInfraCost({ systemConfig: { findUnique } } as any);
        expect(findUnique).toHaveBeenCalledWith({ where: { key: 'infra_cost_rub' } });
        expect(result?.total).toBe(100);
    });

    it('readInfraCost is null when the config row does not exist', async () => {
        const findUnique = vi.fn().mockResolvedValue(null);
        const result = await readInfraCost({ systemConfig: { findUnique } } as any);
        expect(result).toBeNull();
    });
});

describe('webhook-error-rate (O-260817-12, коллектор наконец заполняет webhookErrorRates)', () => {
    it('null when there were no payments in the window — no data, not 0% errors', () => {
        const now = new Date('2026-08-18T00:00:00Z');
        expect(computePaymentFailureRate({ total: 0, failed: 0 }, now)).toBeNull();
    });

    it('computes the failure share out of total', () => {
        const now = new Date('2026-08-18T00:00:00Z');
        const result = computePaymentFailureRate({ total: 20, failed: 3 }, now);
        expect(result?.rate).toBeCloseTo(0.15, 5);
        expect(result?.sampleSize).toBe(20);
        expect(result?.checkedAt).toBe(now.toISOString());
    });

    it('readPaymentFailureRate counts only the last 24h and only status = failed', async () => {
        const now = new Date('2026-08-18T12:00:00Z');
        const count = vi.fn().mockResolvedValueOnce(10).mockResolvedValueOnce(2);
        const result = await readPaymentFailureRate({ payment: { count } } as any, now);

        expect(count).toHaveBeenNthCalledWith(1, { where: { createdAt: { gte: new Date('2026-08-17T12:00:00Z') } } });
        expect(count).toHaveBeenNthCalledWith(2, {
            where: { createdAt: { gte: new Date('2026-08-17T12:00:00Z') }, status: 'failed' },
        });
        expect(result).toEqual({ rate: 0.2, checkedAt: now.toISOString(), sampleSize: 10 });
    });
});

describe('build-minutes (O-260817-12, коллектор наконец заполняет buildMinutesLeft)', () => {
    it('без токена GitHub не делает сетевой запрос вовсе и возвращает null', async () => {
        const fetchImpl = vi.fn();
        const result = await readBuildMinutesLeft({ token: null, org: 'compas-psy' }, fetchImpl as any);
        expect(result).toBeNull();
        expect(fetchImpl).not.toHaveBeenCalled();
    });

    it('без организации тоже не делает запрос', async () => {
        const fetchImpl = vi.fn();
        const result = await readBuildMinutesLeft({ token: 'gh_token', org: null }, fetchImpl as any);
        expect(result).toBeNull();
        expect(fetchImpl).not.toHaveBeenCalled();
    });

    it('с токеном вычисляет остаток минут из ответа GitHub billing API', async () => {
        const fetchImpl = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ included_minutes: 3000, total_minutes_used: 1200 }),
        });
        const result = await readBuildMinutesLeft({ token: 'gh_token', org: 'compas-psy' }, fetchImpl as any);
        expect(result).toBe(1800);
        expect(fetchImpl).toHaveBeenCalledWith(
            'https://api.github.com/orgs/compas-psy/settings/billing/actions',
            expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer gh_token' }) }),
        );
    });

    it('ответ не 2xx — null, не бросает исключение', async () => {
        const fetchImpl = vi.fn().mockResolvedValue({ ok: false });
        const result = await readBuildMinutesLeft({ token: 'gh_token', org: 'compas-psy' }, fetchImpl as any);
        expect(result).toBeNull();
    });

    it('сетевая ошибка — null, не бросает исключение', async () => {
        const fetchImpl = vi.fn().mockRejectedValue(new Error('network down'));
        const result = await readBuildMinutesLeft({ token: 'gh_token', org: 'compas-psy' }, fetchImpl as any);
        expect(result).toBeNull();
    });
});

describe('collectOnce заполняет три объявленных, но никогда не заполнявшихся поля (O-260817-12)', () => {
    function unreachableConfig(overrides: Partial<CollectorConfig> = {}): CollectorConfig {
        return {
            procRoot: '/nonexistent/proc',
            diskPath: '/nonexistent/backups',
            dockerSocketPath: '/nonexistent/docker.sock',
            backupDir: '/nonexistent/backups',
            migrationsDir: '/nonexistent/migrations',
            certHostnames: { primary: 'invalid.test-nonexistent-host.example', secondaryLabel: 'zapiski', secondary: null },
            retentionDays: 90,
            githubActions: { token: null, org: null },
            ...overrides,
        };
    }

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('infraCostRub приходит из SystemConfig, а не остаётся null', async () => {
        const db = {
            $queryRaw: vi.fn().mockResolvedValue([]),
            payment: { count: vi.fn().mockResolvedValue(0) },
            systemConfig: {
                findUnique: vi.fn().mockResolvedValue({
                    value: JSON.stringify({ server: 3000, storage: 500, domains: 200, source: 'manual', updatedAt: '2026-08-18T09:00:00.000Z' }),
                }),
            },
        };

        const result = await collectOnce(db as any, unreachableConfig());

        expect(result.infraCostRub).toEqual({
            server: 3000,
            storage: 500,
            domains: 200,
            total: 3700,
            source: 'manual',
            updatedAt: '2026-08-18T09:00:00.000Z',
        });
    }, 15000);

    it('webhookErrorRates приходит из доли неуспешных платежей за сутки, а не остаётся null', async () => {
        const db = {
            $queryRaw: vi.fn().mockResolvedValue([]),
            payment: { count: vi.fn().mockResolvedValueOnce(10).mockResolvedValueOnce(2) },
            systemConfig: { findUnique: vi.fn().mockResolvedValue(null) },
        };

        const result = await collectOnce(db as any, unreachableConfig());

        expect(result.webhookErrorRates).toMatchObject({
            payments: { rate: 0.2, sampleSize: 10 },
        });
    }, 15000);

    it('buildMinutesLeft остаётся честным null без токена GitHub — не выдумываем доступа', async () => {
        const db = {
            $queryRaw: vi.fn().mockResolvedValue([]),
            payment: { count: vi.fn().mockResolvedValue(0) },
            systemConfig: { findUnique: vi.fn().mockResolvedValue(null) },
        };

        const result = await collectOnce(db as any, unreachableConfig({ githubActions: { token: null, org: null } }));

        expect(result.buildMinutesLeft).toBeNull();
    }, 15000);

    it('buildMinutesLeft считается из GitHub Actions billing API, когда токен задан', async () => {
        const db = {
            $queryRaw: vi.fn().mockResolvedValue([]),
            payment: { count: vi.fn().mockResolvedValue(0) },
            systemConfig: { findUnique: vi.fn().mockResolvedValue(null) },
        };
        vi.stubGlobal(
            'fetch',
            vi.fn().mockResolvedValue({ ok: true, json: async () => ({ included_minutes: 3000, total_minutes_used: 1200 }) }),
        );

        const result = await collectOnce(
            db as any,
            unreachableConfig({ githubActions: { token: 'gh_token', org: 'compas-psy' } }),
        );

        expect(result.buildMinutesLeft).toBe(1800);
    }, 15000);

    it('responseP95Ms приходит из последнего свежего окна AppResponseTime, а не остаётся пустым (ТЗ §5)', async () => {
        const db = {
            $queryRaw: vi.fn().mockResolvedValue([]),
            payment: { count: vi.fn().mockResolvedValue(0) },
            systemConfig: { findUnique: vi.fn().mockResolvedValue(null) },
            appResponseTime: { findFirst: vi.fn().mockResolvedValue({ p95Ms: 340, windowEnd: new Date() }) },
        };

        const result = await collectOnce(db as any, unreachableConfig());

        expect(result.responseP95Ms).toBe(340);
    }, 15000);

    it('responseP95Ms остаётся null, когда окон ещё не было', async () => {
        const db = {
            $queryRaw: vi.fn().mockResolvedValue([]),
            payment: { count: vi.fn().mockResolvedValue(0) },
            systemConfig: { findUnique: vi.fn().mockResolvedValue(null) },
            appResponseTime: { findFirst: vi.fn().mockResolvedValue(null) },
        };

        const result = await collectOnce(db as any, unreachableConfig());

        expect(result.responseP95Ms).toBeNull();
    }, 15000);
});
