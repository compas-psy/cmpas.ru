// O-260829 §4.4: cron живёt в том же процессе, что и веб-сервер
// (src/instrumentation.ts), и на каждый `git push` в main процесс
// перезапускается (deploy-docker.yml). Если рестарт попадал в старое
// ±15-минутное окно вокруг T-24ч/T-1ч, напоминание терялось навсегда: флаг
// notifiedXh не успевал выставиться, а следующий проход cron (через 15 мин)
// уже не находил сессию — она выпадала из нижней границы окна `gte`.
// Отдельно от этого: notifiedXh выставлялся в true БЕЗУСЛОВНО после цикла,
// даже если отправка провалилась на всех задействованных каналах — провал
// был неотличим от успеха и никогда не повторялся.
//
// Эти два теста проверяют оба исправления в src/lib/cron/reminders.ts.

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

describe('processReminders: окно рассылки не теряет пропущенный проход (O-260829 §4.4)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        update.mockResolvedValue({});
        upsert.mockResolvedValue({});
        sendTelegramMessage.mockResolvedValue(true);
        findMany.mockResolvedValue([]);
    });

    it('запрос за 24ч больше не сужен снизу (gte) — только верхняя граница', async () => {
        const { processReminders } = await import('../src/lib/cron/reminders');
        await processReminders();

        const call24 = findMany.mock.calls[0][0];
        expect(call24.where.date).toHaveProperty('lte');
        expect(call24.where.date).not.toHaveProperty('gte');
    });

    it('запрос за 1ч больше не сужен снизу (gte) — только верхняя граница', async () => {
        const { processReminders } = await import('../src/lib/cron/reminders');
        await processReminders();

        const call1 = findMany.mock.calls[1][0];
        expect(call1.where.date).toHaveProperty('lte');
        expect(call1.where.date).not.toHaveProperty('gte');
    });

    it('сессия, пропущенная предыдущим проходом (дата раньше старой нижней границы), всё равно получает напоминание', async () => {
        // Раньше min24 = in24Hours - 15мин отсекал бы такую дату (она на час
        // раньше положенного окна — сервер перезапустился и пропустил проход).
        // Новый запрос отдаёт её как есть (мок findMany это симулирует), и
        // функция обязана её обработать, а не полагаться на дополнительный
        // фильтр внутри себя.
        const missedSession = baseSession({
            date: new Date(Date.now() + 23 * 60 * 60 * 1000), // на час раньше T-24h окна
        });
        findMany.mockResolvedValueOnce([missedSession]).mockResolvedValueOnce([]);

        const { processReminders } = await import('../src/lib/cron/reminders');
        await processReminders();

        expect(sendTelegramMessage).toHaveBeenCalledTimes(1);
        expect(update).toHaveBeenCalledWith({ where: { id: 'session_1' }, data: { notified24h: true } });
    });
});

describe('processReminders: провал на всех каналах не маскируется под "уведомлено" (O-260829 §4.4)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        update.mockResolvedValue({});
        upsert.mockResolvedValue({});
    });

    it('единственный доступный канал (24ч) вернул false — notified24h остаётся false', async () => {
        sendTelegramMessage.mockResolvedValue(false);
        findMany.mockResolvedValueOnce([baseSession()]).mockResolvedValueOnce([]);

        const { processReminders } = await import('../src/lib/cron/reminders');
        await processReminders();

        expect(sendTelegramMessage).toHaveBeenCalledTimes(1);
        expect(update).toHaveBeenCalledWith({ where: { id: 'session_1' }, data: { notified24h: false } });
    });

    it('единственный доступный канал (1ч) вернул false — notified1h остаётся false', async () => {
        sendTelegramMessage.mockResolvedValue(false);
        findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([baseSession()]);

        const { processReminders } = await import('../src/lib/cron/reminders');
        await processReminders();

        expect(sendTelegramMessage).toHaveBeenCalledTimes(1);
        expect(update).toHaveBeenCalledWith({ where: { id: 'session_1' }, data: { notified1h: false } });
    });

    it('клиенту не удалось отправить, но психологу удалось — notified24h всё равно true (успел хотя бы один задействованный канал)', async () => {
        sendTelegramMessage.mockImplementation(async (chatId: string) => chatId === 'tg_psy');
        findMany
            .mockResolvedValueOnce([
                baseSession({ psychologist: { telegramChatId: 'tg_psy', maxChatId: null, psychologistSettings: null } }),
            ])
            .mockResolvedValueOnce([]);

        const { processReminders } = await import('../src/lib/cron/reminders');
        await processReminders();

        expect(update).toHaveBeenCalledWith({ where: { id: 'session_1' }, data: { notified24h: true } });
    });

    it('нет ни одного задействованного канала — notified24h true (повторять нечего, поведение не меняется)', async () => {
        findMany
            .mockResolvedValueOnce([
                baseSession({ client: { id: 'client_1', name: 'Клиент', telegramClient: null, telegramChatId: null, maxChatId: null } }),
            ])
            .mockResolvedValueOnce([]);

        const { processReminders } = await import('../src/lib/cron/reminders');
        await processReminders();

        expect(sendTelegramMessage).not.toHaveBeenCalled();
        expect(update).toHaveBeenCalledWith({ where: { id: 'session_1' }, data: { notified24h: true } });
    });
});
