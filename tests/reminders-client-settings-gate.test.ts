// Задача 20 (P0): тумблеры клиентских напоминаний из приложения обязаны
// что-то выключать.
//
// В приложении появились два переключателя — «за 24 часа» и «за час». Они
// пишутся в NotificationSettings.clientReminder25hEnabled и
// clientReminder1hEnabled. Пока рассылка эти поля не читала, тумблер был
// украшением: специалист его выключал, а клиенту всё равно приходило.
//
// Два правила, которые здесь и проверяются:
//
//   • 24-часовой проход общий с напоминанием СПЕЦИАЛИСТУ — одна выборка и один
//     флаг notified24h. Поэтому клиентский тумблер отсекает только клиентскую
//     ветку; напоминание специалисту он не выключает.
//   • Часовой проход клиентский целиком, поэтому отсекается прямо в выборке:
//     сессия не попадает в задание вовсе, notified1h не выставляется, и
//     включённое обратно напоминание подхватывается следующим проходом.
//
// Выборка в этом тесте не заглушка, а маленький настоящий фильтр: иначе
// «не отправлено» проверялось бы формой запроса, а не поведением.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const update = vi.fn().mockResolvedValue({});
const upsert = vi.fn().mockResolvedValue({});

/** Строки, которые «лежат в базе» для текущего прогона. */
const rows: Record<string, unknown>[] = [];

type Where = Record<string, unknown>;

/** Разбор того подмножества условий Prisma, которым пользуется рассылка. */
function matches(row: unknown, where: Where): boolean {
    const source = (row ?? {}) as Record<string, unknown>;
    return Object.entries(where).every(([key, cond]) => {
        if (key === 'OR') return (cond as Where[]).some((branch) => matches(source, branch));
        const value = source[key];
        if (cond === null) return value === null || value === undefined;
        if (typeof cond === 'object') {
            const c = cond as Where;
            if ('in' in c) return (c.in as unknown[]).includes(value);
            if ('lte' in c) return (value as Date) <= (c.lte as Date);
            if ('is' in c) return c.is === null
                ? value === null || value === undefined
                : value != null && matches(value, c.is as Where);
            return value != null && matches(value, c);
        }
        return value === cond;
    });
}

vi.mock('@/lib/db', () => ({
    db: {
        diarySession: {
            findMany: vi.fn(async ({ where }: { where: Where }) => rows.filter((row) => matches(row, where))),
            update: (...args: unknown[]) => update(...args),
        },
        reminderOutbox: { upsert: (...args: unknown[]) => upsert(...args) },
    },
}));

vi.mock('@/lib/client-workflow', () => ({
    sessionActionToken: () => 'token',
    sessionActionTokenExpiry: (date: Date) => date.getTime() + 48 * 60 * 60 * 1000,
    clientBookingLink: () => 'https://cmpas.ru/bot/book/x',
    publicBaseUrl: () => 'https://cmpas.ru',
}));

const sendTelegramMessage = vi.fn();
vi.mock('@/lib/telegram', () => ({ sendTelegramMessage: (...args: unknown[]) => sendTelegramMessage(...args) }));
vi.mock('@/lib/max', () => ({ sendMaxMessage: vi.fn() }));
vi.mock('@/lib/max-bot', () => ({ sendMaxMessage: vi.fn() }));

/** Сессия «уже пора напоминать»: и суточное окно, и часовое. */
function session(overrides: {
    settings?: Record<string, boolean> | null;
    psychologistTelegram?: string | null;
    notified24h?: boolean;
    notified1h?: boolean;
} = {}) {
    const {
        settings = null,
        psychologistTelegram = null,
        notified24h = false,
        notified1h = false,
    } = overrides;
    return {
        id: 'session_1',
        psychologistId: 'psy_1',
        clientId: 'client_1',
        date: new Date(Date.now() + 30 * 60 * 1000),
        time: '13:00',
        status: 'confirmed',
        format: 'online',
        clientNotificationsEnabled: true,
        notified24h,
        notified1h,
        client: { id: 'client_1', name: 'Клиент', telegramClient: null, telegramChatId: 'tg_client', maxChatId: null },
        psychologist: {
            telegramChatId: psychologistTelegram,
            maxChatId: null,
            psychologistSettings: null,
            notificationSettings: settings,
        },
        address: null,
    };
}

/** Сообщения, ушедшие клиенту (у специалиста другой chat id). */
function clientMessages() {
    return sendTelegramMessage.mock.calls.filter((call) => call[0] === 'tg_client').map((call) => String(call[1]));
}

async function run() {
    const { processReminders } = await import('../src/lib/cron/reminders');
    await processReminders();
}

beforeEach(() => {
    vi.clearAllMocks();
    update.mockResolvedValue({});
    upsert.mockResolvedValue({});
    sendTelegramMessage.mockResolvedValue(true);
    rows.length = 0;
});

describe('напоминание клиенту за 24 часа', () => {
    it('тумблер включён — напоминание уходит', async () => {
        rows.push(session({ settings: { clientReminder25hEnabled: true, clientReminder1hEnabled: true }, notified1h: true }));

        await run();

        expect(clientMessages()).toHaveLength(1);
    });

    it('тумблер выключен — напоминание не уходит', async () => {
        rows.push(session({ settings: { clientReminder25hEnabled: false, clientReminder1hEnabled: true }, notified1h: true }));

        await run();

        expect(clientMessages()).toEqual([]);
    });

    it('напоминание СПЕЦИАЛИСТУ выключенным клиентским тумблером не гасится', async () => {
        rows.push(session({
            settings: { clientReminder25hEnabled: false, clientReminder1hEnabled: true },
            psychologistTelegram: 'tg_psy',
            notified1h: true,
        }));

        await run();

        expect(clientMessages()).toEqual([]);
        expect(sendTelegramMessage).toHaveBeenCalledTimes(1);
        expect(sendTelegramMessage).toHaveBeenCalledWith('tg_psy', expect.any(String), expect.anything());
    });

    it('выключенный тумблер — это не сбой доставки: сессия помечается обработанной и не долбится каждые 15 минут', async () => {
        rows.push(session({ settings: { clientReminder25hEnabled: false, clientReminder1hEnabled: true }, notified1h: true }));

        await run();

        expect(update).toHaveBeenCalledWith({ where: { id: 'session_1' }, data: { notified24h: true } });
    });
});

describe('напоминание клиенту за час', () => {
    it('тумблер включён — напоминание уходит', async () => {
        rows.push(session({ settings: { clientReminder25hEnabled: true, clientReminder1hEnabled: true }, notified24h: true }));

        await run();

        expect(clientMessages()).toHaveLength(1);
        expect(clientMessages()[0]).toContain('через 1 час');
    });

    it('тумблер выключен — напоминание не уходит', async () => {
        rows.push(session({ settings: { clientReminder25hEnabled: true, clientReminder1hEnabled: false }, notified24h: true }));

        await run();

        expect(clientMessages()).toEqual([]);
    });

    it('выключенное напоминание не помечается отправленным — включив тумблер обратно, специалист получает его в следующий проход', async () => {
        const off = session({ settings: { clientReminder25hEnabled: true, clientReminder1hEnabled: false }, notified24h: true });
        rows.push(off);

        await run();
        expect(update).not.toHaveBeenCalled();

        vi.clearAllMocks();
        sendTelegramMessage.mockResolvedValue(true);
        (off.psychologist.notificationSettings as Record<string, boolean>).clientReminder1hEnabled = true;

        await run();

        expect(clientMessages()).toHaveLength(1);
        expect(update).toHaveBeenCalledWith({ where: { id: 'session_1' }, data: { notified1h: true } });
    });
});

describe('настроек ещё нет', () => {
    it('оба напоминания уходят: пустая строка настроек — это «специалист ничего не менял», а не «выключено»', async () => {
        rows.push(session({ settings: null }));

        await run();

        const texts = clientMessages();
        expect(texts).toHaveLength(2);
        expect(texts.some((text) => text.includes('через 1 час'))).toBe(true);
    });

    it('тумблеры независимы: выключенные сутки не гасят час', async () => {
        rows.push(session({ settings: { clientReminder25hEnabled: false, clientReminder1hEnabled: true } }));

        await run();

        const texts = clientMessages();
        expect(texts).toHaveLength(1);
        expect(texts[0]).toContain('через 1 час');
    });
});
