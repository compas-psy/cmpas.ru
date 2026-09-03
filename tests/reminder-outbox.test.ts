// O-260817-16: ReminderOutbox не существовала, поэтому карточка «Рассылка»
// панели молчала как no_data (src/lib/infra-pulse/reminders-counters.ts
// честно проверяет её наличие через to_regclass). Эти тесты проверяют
// единственное реальное место отправки напоминаний — processReminders()
// (src/lib/cron/reminders.ts) — и то, что оно пишет строку в ReminderOutbox
// на каждую фактическую попытку отправки: успешную и неуспешную, клиенту и
// психологу, за 24 часа и за час.

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

// Пути мокаются через alias '@/lib/...', а не относительно этого тестового
// файла ('../telegram') — vi.mock резолвит id так же, как резолвил бы его
// сам reminders.ts, поэтому важен итоговый абсолютный файл, а не буквальная
// строка импорта. '@/lib/telegram' и '../telegram' из src/lib/cron/
// указывают на один и тот же src/lib/telegram.ts.
const sendTelegramMessage = vi.fn();
vi.mock('@/lib/telegram', () => ({
    sendTelegramMessage: (...args: unknown[]) => sendTelegramMessage(...args),
}));

const sendMaxText = vi.fn();
vi.mock('@/lib/max', () => ({
    sendMaxMessage: (...args: unknown[]) => sendMaxText(...args),
}));

const sendMaxFull = vi.fn();
vi.mock('@/lib/max-bot', () => ({
    sendMaxMessage: (...args: unknown[]) => sendMaxFull(...args),
}));

function baseSession(overrides: Record<string, unknown> = {}) {
    return {
        id: 'session_1',
        psychologistId: 'psy_1',
        clientId: 'client_1',
        date: new Date('2026-08-19T10:00:00Z'),
        time: '13:00',
        status: 'confirmed',
        format: 'online',
        notified24h: false,
        notified1h: false,
        clientNotificationsEnabled: true,
        client: { id: 'client_1', name: 'Клиент', telegramClient: null, telegramChatId: 'tg_client', maxChatId: null },
        psychologist: { telegramChatId: null, maxChatId: null, psychologistSettings: null },
        address: null,
        ...overrides,
    };
}

describe('processReminders пишет ReminderOutbox на каждую фактическую отправку (O-260817-16)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        update.mockResolvedValue({});
        upsert.mockResolvedValue({});
    });

    it('успешная 24-часовая отправка клиенту в Telegram создаёт строку со статусом sent', async () => {
        sendTelegramMessage.mockResolvedValue(true);
        findMany.mockResolvedValueOnce([baseSession()]).mockResolvedValueOnce([]);

        const { processReminders } = await import('../src/lib/cron/reminders');
        await processReminders();

        expect(sendTelegramMessage).toHaveBeenCalledTimes(1);
        expect(upsert).toHaveBeenCalledTimes(1);
        const call = upsert.mock.calls[0][0];
        expect(call.where).toEqual({ sessionId_type_channel: { sessionId: 'session_1', type: 'session_24h_client', channel: 'telegram' } });
        expect(call.create).toMatchObject({
            type: 'session_24h_client',
            channel: 'telegram',
            recipient: 'tg_client',
            sessionId: 'session_1',
            status: 'sent',
            error: null,
            sendCount: 1,
        });
        expect(call.create.sentAt).toBeInstanceOf(Date);
        // dueAt — теоретический момент отправки: время сессии минус 24ч.
        expect(call.create.dueAt.toISOString()).toBe('2026-08-18T10:00:00.000Z');
    });

    it('неудачная отправка (sendTelegramMessage вернул false) пишет статус error, а не sent', async () => {
        sendTelegramMessage.mockResolvedValue(false);
        findMany.mockResolvedValueOnce([baseSession()]).mockResolvedValueOnce([]);

        const { processReminders } = await import('../src/lib/cron/reminders');
        await processReminders();

        expect(upsert).toHaveBeenCalledTimes(1);
        const call = upsert.mock.calls[0][0];
        expect(call.create.status).toBe('error');
        expect(call.create.sentAt).toBeNull();
        expect(call.create.error).toBeTruthy();
    });

    it('напоминание психологу пишет отдельную строку с типом session_24h_psychologist', async () => {
        sendTelegramMessage.mockResolvedValue(true);
        findMany
            .mockResolvedValueOnce([baseSession({ psychologist: { telegramChatId: 'tg_psy', maxChatId: null, psychologistSettings: null } })])
            .mockResolvedValueOnce([]);

        const { processReminders } = await import('../src/lib/cron/reminders');
        await processReminders();

        // Один вызов на клиента, один на психолога.
        expect(upsert).toHaveBeenCalledTimes(2);
        const types = upsert.mock.calls.map((c) => c[0].create.type);
        expect(types).toContain('session_24h_client');
        expect(types).toContain('session_24h_psychologist');
    });

    it('часовое напоминание клиенту пишет тип session_1h_client с dueAt = время сессии минус час', async () => {
        sendTelegramMessage.mockResolvedValue(true);
        findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([baseSession()]);

        const { processReminders } = await import('../src/lib/cron/reminders');
        await processReminders();

        expect(upsert).toHaveBeenCalledTimes(1);
        const call = upsert.mock.calls[0][0];
        expect(call.create.type).toBe('session_1h_client');
        expect(call.create.dueAt.toISOString()).toBe('2026-08-19T09:00:00.000Z');
    });

    it('оба канала сразу (Telegram и MAX) пишут по отдельной строке каждый', async () => {
        sendTelegramMessage.mockResolvedValue(true);
        // Client-напоминания всегда несут inline-клавиатуру (sessionActions), поэтому
        // реально уходят через sendMaxFull ('@/lib/max-bot'), не sendMaxText ('@/lib/max').
        sendMaxFull.mockResolvedValue({ success: true });
        findMany
            .mockResolvedValueOnce([
                baseSession({
                    client: { id: 'client_1', name: 'Клиент', telegramClient: null, telegramChatId: 'tg_client', maxChatId: 'max_client' },
                }),
            ])
            .mockResolvedValueOnce([]);

        const { processReminders } = await import('../src/lib/cron/reminders');
        await processReminders();

        expect(upsert).toHaveBeenCalledTimes(2);
        const channels = upsert.mock.calls.map((c) => c[0].create.channel).sort();
        expect(channels).toEqual(['max', 'telegram']);
    });

    it('MAX-ответ с success:false считается неуспешной отправкой', async () => {
        sendTelegramMessage.mockResolvedValue(true);
        sendMaxFull.mockResolvedValue({ success: false });
        findMany
            .mockResolvedValueOnce([
                baseSession({
                    client: { id: 'client_1', name: 'Клиент', telegramClient: null, telegramChatId: null, maxChatId: 'max_client' },
                }),
            ])
            .mockResolvedValueOnce([]);

        const { processReminders } = await import('../src/lib/cron/reminders');
        await processReminders();

        expect(upsert).toHaveBeenCalledTimes(1);
        expect(upsert.mock.calls[0][0].create.status).toBe('error');
    });

    it('повторный проход по той же сессии/каналу обновляет существующую строку и увеличивает sendCount (upsert.update, не create)', async () => {
        sendTelegramMessage.mockResolvedValue(true);
        findMany.mockResolvedValueOnce([baseSession()]).mockResolvedValueOnce([]);

        const { processReminders } = await import('../src/lib/cron/reminders');
        await processReminders();

        const call = upsert.mock.calls[0][0];
        expect(call.update.sendCount).toEqual({ increment: 1 });
        expect(call.update.status).toBe('sent');
    });

    it('падение записи в ReminderOutbox не мешает самой отправке и не роняет processReminders', async () => {
        sendTelegramMessage.mockResolvedValue(true);
        upsert.mockRejectedValue(new Error('db down'));
        findMany.mockResolvedValueOnce([baseSession()]).mockResolvedValueOnce([]);

        const { processReminders } = await import('../src/lib/cron/reminders');
        await expect(processReminders()).resolves.toBeUndefined();
        expect(sendTelegramMessage).toHaveBeenCalledTimes(1);
        expect(update).toHaveBeenCalledWith({ where: { id: 'session_1' }, data: { notified24h: true } });
    });
});
