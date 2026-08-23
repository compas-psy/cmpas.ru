// Срок хранения AnalyticsEvent — 180 дней (решение учредителя 6, "Общий
// срок хранения — 180 дней"). До этой задачи ничто не удаляло строки
// AnalyticsEvent вовсе (установленный факт) — этот тест ловит именно
// отсутствие такой задачи, а не деталь её реализации.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { pruneOldAnalyticsEvents, ANALYTICS_RETENTION_DAYS } from '@/lib/cron/analytics-retention';

interface EventRecord { id: string; ts: Date }

function makeDb(events: EventRecord[]) {
    let rows = [...events];
    const db = {
        analyticsEvent: {
            deleteMany: async ({ where }: any) => {
                const cutoff: Date = where.ts.lt;
                const before = rows.length;
                rows = rows.filter((e) => e.ts >= cutoff);
                return { count: before - rows.length };
            },
        },
    };
    return { db: db as any, getRows: () => rows };
}

describe('pruneOldAnalyticsEvents (180 дней)', () => {
    it('ANALYTICS_RETENTION_DAYS равен 180', () => {
        expect(ANALYTICS_RETENTION_DAYS).toBe(180);
    });

    it('удаляет событие старше 180 дней', async () => {
        const now = new Date('2026-08-23T00:00:00Z');
        const old = new Date('2026-01-01T00:00:00Z'); // > 180 дней назад
        const { db, getRows } = makeDb([{ id: 'old', ts: old }]);
        await pruneOldAnalyticsEvents(db, now);
        expect(getRows()).toHaveLength(0);
    });

    it('не удаляет свежее событие (в пределах 180 дней)', async () => {
        const now = new Date('2026-08-23T00:00:00Z');
        const fresh = new Date('2026-08-01T00:00:00Z'); // < 180 дней назад
        const { db, getRows } = makeDb([{ id: 'fresh', ts: fresh }]);
        await pruneOldAnalyticsEvents(db, now);
        expect(getRows()).toHaveLength(1);
    });

    it('смешанный набор: старые удалены, свежие остаются', async () => {
        const now = new Date('2026-08-23T00:00:00Z');
        const old = new Date('2026-01-01T00:00:00Z');
        const fresh = new Date('2026-08-01T00:00:00Z');
        const { db, getRows } = makeDb([{ id: 'old', ts: old }, { id: 'fresh', ts: fresh }]);
        await pruneOldAnalyticsEvents(db, now);
        expect(getRows().map((r) => r.id)).toEqual(['fresh']);
    });
});

describe('cron-обвязка в src/instrumentation.ts', () => {
    it('регистрирует периодическую задачу срока хранения через node-cron', async () => {
        // Не гоняем сам instrumentation.ts (он тянет next/server и реальный
        // node-cron .schedule, поднимающий таймеры) — просто убеждаемся, что
        // модуль ссылается на новую cron-задачу тем же способом, что и на
        // остальные (см. src/lib/cron/response-time.ts, flushResponseTimeWindow).
        const fs = await import('fs');
        const path = await import('path');
        const src = fs.readFileSync(path.join(process.cwd(), 'src/instrumentation.ts'), 'utf8');
        expect(src).toMatch(/analytics-retention/);
        expect(src).toMatch(/pruneOldAnalyticsEvents/);
    });
});
