// Task 9 (PRAKTIKA MVP, founder review 2026-09-03): client-facing reminders
// are gated on DiarySession.clientNotificationsEnabled — a real boolean
// communication-policy field — NEVER on origin. origin is provenance/audit
// only (see src/lib/practice/session-origin.ts); a session can be
// origin='calendar_import' with notifications explicitly re-enabled later,
// and a manual/self_booking session could in principle have them off too —
// the boolean alone decides, in both directions.
//
// The 24h reminder shares one query (and one notified24h flag) with the
// PSYCHOLOGIST-facing 24h reminder, so it's gated in-loop rather than via
// the query's WHERE — a query-level filter would incorrectly hide the
// session from the psychologist-facing block too, which must stay
// unaffected. The 1h reminder has no such counterpart, so it IS filtered at
// the query level (see src/lib/cron/reminders.ts).

import { describe, it, expect, vi, beforeEach } from 'vitest';

const findMany = vi.fn();
const update = vi.fn().mockResolvedValue({});
const upsert = vi.fn().mockResolvedValue({});

vi.mock('@/lib/db', () => ({
    db: {
        diarySession: {
            findMany: (...args: unknown[]) => findMany(...args),
            update: (...args: unknown[]) => update(...args),
        },
        reminderOutbox: {
            upsert: (...args: unknown[]) => upsert(...args),
        },
    },
}));

vi.mock('@/lib/client-workflow', () => ({
    sessionActionToken: () => 'token',
    sessionActionTokenExpiry: (date: Date) => date.getTime() + 48 * 60 * 60 * 1000,
    clientBookingLink: () => 'https://cmpas.ru/bot/book/x',
    publicBaseUrl: () => 'https://cmpas.ru',
}));

const sendTelegramMessage = vi.fn();
vi.mock('@/lib/telegram', () => ({
    sendTelegramMessage: (...args: unknown[]) => sendTelegramMessage(...args),
}));
vi.mock('@/lib/max', () => ({ sendMaxMessage: vi.fn() }));
vi.mock('@/lib/max-bot', () => ({ sendMaxMessage: vi.fn() }));

function baseSession(overrides: Record<string, unknown> = {}) {
    return {
        id: 'session_1',
        psychologistId: 'psy_1',
        clientId: 'client_1',
        date: new Date('2026-08-19T10:00:00Z'),
        time: '13:00',
        status: 'confirmed',
        format: 'online',
        origin: 'manual',
        clientNotificationsEnabled: true,
        notified24h: false,
        notified1h: false,
        client: { id: 'client_1', name: 'Клиент', telegramClient: null, telegramChatId: 'tg_client', maxChatId: null },
        psychologist: { telegramChatId: null, maxChatId: null, psychologistSettings: null },
        address: null,
        ...overrides,
    };
}

describe('processReminders 24h: gated on clientNotificationsEnabled, never on origin (Task 9)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        update.mockResolvedValue({});
        upsert.mockResolvedValue({});
        sendTelegramMessage.mockResolvedValue(true);
        findMany.mockResolvedValue([]);
    });

    it('clientNotificationsEnabled=false: sends NOTHING to the client, but still marks notified24h', async () => {
        findMany.mockResolvedValueOnce([baseSession({ clientNotificationsEnabled: false })]).mockResolvedValueOnce([]);

        const { processReminders } = await import('../src/lib/cron/reminders');
        await processReminders();

        expect(sendTelegramMessage).not.toHaveBeenCalled();
        expect(update).toHaveBeenCalledWith({ where: { id: 'session_1' }, data: { notified24h: true } });
    });

    it('clientNotificationsEnabled=false: the PSYCHOLOGIST-facing reminder still fires — untouched by this flag', async () => {
        findMany.mockResolvedValueOnce([
            baseSession({
                clientNotificationsEnabled: false,
                psychologist: { telegramChatId: 'tg_psy', maxChatId: null, psychologistSettings: null },
            }),
        ]).mockResolvedValueOnce([]);

        const { processReminders } = await import('../src/lib/cron/reminders');
        await processReminders();

        expect(sendTelegramMessage).toHaveBeenCalledTimes(1);
        expect(sendTelegramMessage).toHaveBeenCalledWith('tg_psy', expect.any(String), expect.anything());
        expect(sendTelegramMessage).not.toHaveBeenCalledWith('tg_client', expect.anything(), expect.anything());
    });

    it("origin='calendar_import' with clientNotificationsEnabled=true: the client reminder MAY still go out — origin alone never blocks it", async () => {
        findMany.mockResolvedValueOnce([
            baseSession({ origin: 'calendar_import', clientNotificationsEnabled: true }),
        ]).mockResolvedValueOnce([]);

        const { processReminders } = await import('../src/lib/cron/reminders');
        await processReminders();

        expect(sendTelegramMessage).toHaveBeenCalledWith('tg_client', expect.any(String), expect.anything());
    });

    it("origin='manual' with clientNotificationsEnabled=false: the client reminder does NOT go out — the boolean alone decides", async () => {
        findMany.mockResolvedValueOnce([
            baseSession({ origin: 'manual', clientNotificationsEnabled: false }),
        ]).mockResolvedValueOnce([]);

        const { processReminders } = await import('../src/lib/cron/reminders');
        await processReminders();

        expect(sendTelegramMessage).not.toHaveBeenCalled();
    });
});

describe('processReminders 1h: filtered at the query level (Task 9)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        update.mockResolvedValue({});
        upsert.mockResolvedValue({});
        findMany.mockResolvedValue([]);
    });

    it('the 1h query filters clientNotificationsEnabled: true — a disabled session never reaches this job at all', async () => {
        const { processReminders } = await import('../src/lib/cron/reminders');
        await processReminders();

        const call1 = findMany.mock.calls[1][0];
        expect(call1.where.clientNotificationsEnabled).toBe(true);
    });
});
