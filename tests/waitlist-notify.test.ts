// O-260829 §5.2: WaitlistEntry раньше только копила заявки — никто не читал
// их при освобождении часа (отмена/перенос). notifyWaitlistOnFreedSlot
// (src/lib/waitlist-notify.ts) закрывает разрыв: одно тихое сообщение самой
// старой подходящей заявке, без денег, без "мест осталось", без спама всем
// подряд.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const waitlistFindMany = vi.fn();
const waitlistUpdate = vi.fn().mockResolvedValue({});
const telegramClientFindFirst = vi.fn();
const diaryClientFindMany = vi.fn();
const userFindUnique = vi.fn();

vi.mock('@/lib/db', () => ({
    db: {
        waitlistEntry: {
            findMany: (...args: unknown[]) => waitlistFindMany(...args),
            update: (...args: unknown[]) => waitlistUpdate(...args),
        },
        telegramClient: {
            findFirst: (...args: unknown[]) => telegramClientFindFirst(...args),
        },
        diaryClient: {
            findMany: (...args: unknown[]) => diaryClientFindMany(...args),
        },
        user: {
            findUnique: (...args: unknown[]) => userFindUnique(...args),
        },
    },
}));

vi.mock('@/lib/client-workflow', () => ({
    publicBaseUrl: () => 'https://cmpas.ru',
}));

const sendTelegramMessage = vi.fn();
vi.mock('@/lib/telegram', () => ({
    sendTelegramMessage: (...args: unknown[]) => sendTelegramMessage(...args),
}));

const sendMaxMessage = vi.fn();
vi.mock('@/lib/max', () => ({
    sendMaxMessage: (...args: unknown[]) => sendMaxMessage(...args),
}));

function entry(overrides: Record<string, unknown> = {}) {
    return {
        id: 'wl_1',
        psychologistId: 'psy_1',
        name: 'Клиент',
        contact: '+7 999 123-45-67',
        preference: 'any',
        createdAt: new Date('2026-08-01T00:00:00Z'),
        notifiedAt: null,
        ...overrides,
    };
}

describe('notifyWaitlistOnFreedSlot (O-260829 §5.2)', () => {
    const ORIGINAL_FLAG = process.env.PRACTICE_WAITLIST_AUTO_NOTIFY_ENABLED;

    beforeEach(() => {
        vi.clearAllMocks();
        // PRAKTIKA MVP addendum §7: механика не входит в launch scope и по
        // умолчанию выключена флагом — весь остальной файл проверяет её
        // поведение "как если бы она была включена" (отдельное решение
        // владельца), поэтому явно включаем здесь.
        process.env.PRACTICE_WAITLIST_AUTO_NOTIFY_ENABLED = 'true';
        userFindUnique.mockResolvedValue({ name: 'Анна Волкова', psychologistSettings: null });
        sendTelegramMessage.mockResolvedValue(true);
        sendMaxMessage.mockResolvedValue({ success: true });
    });

    afterEach(() => {
        process.env.PRACTICE_WAITLIST_AUTO_NOTIFY_ENABLED = ORIGINAL_FLAG;
    });

    it('addendum §7: по умолчанию (флаг не задан) не читает базу и не шлёт сообщений', async () => {
        delete process.env.PRACTICE_WAITLIST_AUTO_NOTIFY_ENABLED;

        const { notifyWaitlistOnFreedSlot } = await import('../src/lib/waitlist-notify');
        const result = await notifyWaitlistOnFreedSlot('psy_1', new Date('2026-09-10T00:00:00Z'), '15:00');

        expect(result).toEqual({ notified: false });
        expect(waitlistFindMany).not.toHaveBeenCalled();
        expect(sendTelegramMessage).not.toHaveBeenCalled();
        expect(sendMaxMessage).not.toHaveBeenCalled();
    });

    it('отправляет ровно одно сообщение самой старой подходящей заявке и помечает её notifiedAt', async () => {
        waitlistFindMany.mockResolvedValue([
            entry({ id: 'wl_old', contact: '+79991234567', createdAt: new Date('2026-08-01T00:00:00Z') }),
            entry({ id: 'wl_new', contact: '+79997654321', createdAt: new Date('2026-08-05T00:00:00Z') }),
        ]);
        diaryClientFindMany.mockResolvedValue([
            { phone: '+7 (999) 123-45-67', telegramChatId: 'tg_1', maxChatId: null },
            { phone: '+7 (999) 765-43-21', telegramChatId: 'tg_2', maxChatId: null },
        ]);

        const { notifyWaitlistOnFreedSlot } = await import('../src/lib/waitlist-notify');
        const result = await notifyWaitlistOnFreedSlot('psy_1', new Date('2026-09-10T00:00:00Z'), '15:00');

        expect(result).toEqual({ notified: true, entryId: 'wl_old' });
        expect(sendTelegramMessage).toHaveBeenCalledTimes(1);
        expect(sendTelegramMessage.mock.calls[0][0]).toBe('tg_1');
        expect(sendTelegramMessage.mock.calls[0][1]).not.toMatch(/мест|осталось|очеред/i);
        expect(waitlistUpdate).toHaveBeenCalledWith({ where: { id: 'wl_old' }, data: { notifiedAt: expect.any(Date) } });
        // Вторую заявку не трогаем вовсе — "первый в очереди", а не все сразу.
        expect(waitlistUpdate).toHaveBeenCalledTimes(1);
    });

    it('повторный вызов по той же самой заявке не шлёт второе сообщение (notifiedAt уже стоит)', async () => {
        // findMany уже фильтрует notifiedAt: null — вторая заявка просто не придёт в выборке.
        waitlistFindMany.mockResolvedValue([]);

        const { notifyWaitlistOnFreedSlot } = await import('../src/lib/waitlist-notify');
        const result = await notifyWaitlistOnFreedSlot('psy_1', new Date('2026-09-10T00:00:00Z'), '15:00');

        expect(result).toEqual({ notified: false });
        expect(sendTelegramMessage).not.toHaveBeenCalled();
    });

    it('предпочтение заявки не совпадает со свободным часом — сообщение не уходит', async () => {
        waitlistFindMany.mockResolvedValue([
            entry({ preference: 'weekend_morning' }),
        ]);

        const { notifyWaitlistOnFreedSlot } = await import('../src/lib/waitlist-notify');
        // Вторник, вечер — не подходит под weekend_morning.
        const result = await notifyWaitlistOnFreedSlot('psy_1', new Date('2026-09-15T00:00:00Z'), '19:00');

        expect(result).toEqual({ notified: false });
        expect(sendTelegramMessage).not.toHaveBeenCalled();
        expect(diaryClientFindMany).not.toHaveBeenCalled();
    });

    it('контакт нельзя сопоставить ни с одним клиентом — заявка помечена, но следующая подходящая получает сообщение', async () => {
        waitlistFindMany.mockResolvedValue([
            entry({ id: 'wl_unreachable', contact: '+70000000000', createdAt: new Date('2026-08-01T00:00:00Z') }),
            entry({ id: 'wl_reachable', contact: '+79991234567', createdAt: new Date('2026-08-05T00:00:00Z') }),
        ]);
        diaryClientFindMany.mockResolvedValue([
            { phone: '+7 999 123 45 67', telegramChatId: 'tg_1', maxChatId: null },
        ]);

        const { notifyWaitlistOnFreedSlot } = await import('../src/lib/waitlist-notify');
        const result = await notifyWaitlistOnFreedSlot('psy_1', new Date('2026-09-10T00:00:00Z'), '15:00');

        expect(result).toEqual({ notified: true, entryId: 'wl_reachable' });
        expect(waitlistUpdate).toHaveBeenCalledTimes(2);
        expect(sendTelegramMessage).toHaveBeenCalledTimes(1);
    });

    it('контакт вида @username резолвится через TelegramClient', async () => {
        waitlistFindMany.mockResolvedValue([entry({ contact: '@anna_client' })]);
        telegramClientFindFirst.mockResolvedValue({ telegramUserId: 'tg_username_1' });

        const { notifyWaitlistOnFreedSlot } = await import('../src/lib/waitlist-notify');
        const result = await notifyWaitlistOnFreedSlot('psy_1', new Date('2026-09-10T00:00:00Z'), '15:00');

        expect(result).toEqual({ notified: true, entryId: 'wl_1' });
        expect(telegramClientFindFirst).toHaveBeenCalledWith({
            where: { psychologistId: 'psy_1', telegramUsername: { equals: 'anna_client', mode: 'insensitive' } },
        });
        expect(sendTelegramMessage).toHaveBeenCalledWith('tg_username_1', expect.any(String));
    });

    it('пустой лист ожидания — ничего не отправляется', async () => {
        waitlistFindMany.mockResolvedValue([]);

        const { notifyWaitlistOnFreedSlot } = await import('../src/lib/waitlist-notify');
        const result = await notifyWaitlistOnFreedSlot('psy_1', new Date('2026-09-10T00:00:00Z'), '15:00');

        expect(result).toEqual({ notified: false });
        expect(sendTelegramMessage).not.toHaveBeenCalled();
        expect(sendMaxMessage).not.toHaveBeenCalled();
    });
});
