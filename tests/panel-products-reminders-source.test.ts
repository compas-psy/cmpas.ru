// B3: q_practice_reminders (products.ts) был жёстко закодирован как no_data
// с причиной "журнал отправок не заведён — сверять «должны были уйти» не с
// чем". Это было верно до потока A: с коммита о ReminderOutbox
// (11ff5a7 «Заводим ReminderOutbox и пишем в неё на месте фактической
// отправки») таблица заведена, cron пишет в неё, а коллектор InfraPulse её
// уже читает (src/lib/infra-pulse/reminders-counters.ts, collector.ts:95) —
// и даже показывает на экране «Техника» (q_tech_channels, tech.ts:218-240).
// Причина no_data в products.ts стала фактически неверной: источник есть,
// его просто не читали здесь.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const findFirst = vi.fn();
vi.mock('@/lib/db', () => ({ db: { infraPulse: { findFirst: (...args: unknown[]) => findFirst(...args) } } }));

import { qPracticeReminders } from '@/lib/panel/queries/products';

beforeEach(() => {
    findFirst.mockReset();
});

describe('qPracticeReminders (B3 — источник ReminderOutbox через InfraPulse)', () => {
    it('коллектор ещё ни разу не присылал показаний — no_data', async () => {
        findFirst.mockResolvedValue(null);
        const block = await qPracticeReminders();
        expect(block.state).toBe('no_data');
        expect(block.data).toBeNull();
    });

    it('показание есть, но remindersDue ещё null (коллектор старше миграции ReminderOutbox) — no_data, а не выдуманный ноль', async () => {
        findFirst.mockResolvedValue({ collectedAt: new Date(), remindersDue: null, remindersSent: null, remindersSentTwice: null });
        const block = await qPracticeReminders();
        expect(block.state).toBe('no_data');
    });

    it('свежее показание с реальными числами — ok', async () => {
        findFirst.mockResolvedValue({ collectedAt: new Date(), remindersDue: 20, remindersSent: 18, remindersSentTwice: 1 });
        const block = await qPracticeReminders();
        expect(block.state).toBe('ok');
        expect(block.data).toMatchObject({ due: 20, sent: 18, sentTwice: 1 });
    });

    it('показание старше порога свежести — stale, не ok', async () => {
        const old = new Date(Date.now() - 60 * 60000);
        findFirst.mockResolvedValue({ collectedAt: old, remindersDue: 20, remindersSent: 18, remindersSentTwice: 1 });
        const block = await qPracticeReminders();
        expect(block.state).toBe('stale');
    });
});
