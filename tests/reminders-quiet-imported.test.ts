// Task 9 (PRAKTIKA MVP): a session imported from an external calendar
// (DiarySession.origin === 'import') was never booked by the client through
// us — no automated "your session is tomorrow / starts in an hour" message
// to them. The psychologist-facing 24h reminder is unaffected: they already
// know about their own import.

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
        notified24h: false,
        notified1h: false,
        client: { id: 'client_1', name: 'Клиент', telegramClient: null, telegramChatId: 'tg_client', maxChatId: null },
        psychologist: { telegramChatId: null, maxChatId: null, psychologistSettings: null },
        address: null,
        ...overrides,
    };
}

describe('processReminders: quiet on imported sessions (Task 9)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        update.mockResolvedValue({});
        upsert.mockResolvedValue({});
        sendTelegramMessage.mockResolvedValue(true);
        findMany.mockResolvedValue([]);
    });

    it('24h reminder: an imported session sends NOTHING to the client, but still marks notified24h', async () => {
        findMany.mockResolvedValueOnce([baseSession({ origin: 'import' })]).mockResolvedValueOnce([]);

        const { processReminders } = await import('../src/lib/cron/reminders');
        await processReminders();

        expect(sendTelegramMessage).not.toHaveBeenCalled();
        expect(update).toHaveBeenCalledWith({ where: { id: 'session_1' }, data: { notified24h: true } });
    });

    it('24h reminder: the PSYCHOLOGIST-facing reminder still fires for an imported session — they already know about their own import', async () => {
        findMany.mockResolvedValueOnce([
            baseSession({
                origin: 'import',
                psychologist: { telegramChatId: 'tg_psy', maxChatId: null, psychologistSettings: null },
            }),
        ]).mockResolvedValueOnce([]);

        const { processReminders } = await import('../src/lib/cron/reminders');
        await processReminders();

        // Exactly one send — to the psychologist, not the client (whose
        // channel is tg_client, never passed to sendTelegramMessage here).
        expect(sendTelegramMessage).toHaveBeenCalledTimes(1);
        expect(sendTelegramMessage).toHaveBeenCalledWith('tg_psy', expect.any(String), expect.anything());
        expect(sendTelegramMessage).not.toHaveBeenCalledWith('tg_client', expect.anything(), expect.anything());
    });

    it('1h reminder: an imported session sends nothing and still marks notified1h', async () => {
        findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([baseSession({ origin: 'import' })]);

        const { processReminders } = await import('../src/lib/cron/reminders');
        await processReminders();

        expect(sendTelegramMessage).not.toHaveBeenCalled();
        expect(update).toHaveBeenCalledWith({ where: { id: 'session_1' }, data: { notified1h: true } });
    });

    it('a NON-imported (manual/self_booking) session is unaffected — still sends to the client as before', async () => {
        findMany.mockResolvedValueOnce([baseSession({ origin: 'self_booking' })]).mockResolvedValueOnce([]);

        const { processReminders } = await import('../src/lib/cron/reminders');
        await processReminders();

        expect(sendTelegramMessage).toHaveBeenCalledWith('tg_client', expect.any(String), expect.anything());
    });
});
