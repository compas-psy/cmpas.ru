// Telegram: контакт приходит штатным message.contact, но обработчика на
// него у бота не было вовсе — пересланный контакт молча пропадал.
//
// Тест идёт не через живой Telegraf, а через реестр зарегистрированных
// обработчиков: важно, что обработчик ЗАРЕГИСТРИРОВАН на нужный фильтр и
// что он делает, а не как Telegraf разбирает апдейт внутри.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const previewContactIntake = vi.fn();
const commitContactIntake = vi.fn();
vi.mock('@/lib/clients/contact-intake', () => ({
    previewContactIntake: (...a: unknown[]) => previewContactIntake(...a),
    commitContactIntake: (...a: unknown[]) => commitContactIntake(...a),
}));

const userFindUnique = vi.fn();
vi.mock('@/lib/db', () => ({
    db: {
        user: { findUnique: (...a: unknown[]) => userFindUnique(...a), findFirst: vi.fn() },
        diarySession: { findUnique: vi.fn(), findMany: vi.fn(), update: vi.fn() },
        diaryClient: { findFirst: vi.fn(), findMany: vi.fn(), update: vi.fn() },
        scheduledClientMessage: { findMany: vi.fn(), update: vi.fn() },
        telegramClient: { findUnique: vi.fn(), upsert: vi.fn(), updateMany: vi.fn() },
    },
}));
vi.mock('@/lib/notifications', () => ({ createNotification: vi.fn() }));
vi.mock('@/lib/calendar/auto-sync', () => ({ autoDeleteSessionFromCalendars: vi.fn() }));
vi.mock('@/lib/client-cancellation', () => ({ canClientCancel: vi.fn(), clientCancelBlockedMessage: vi.fn() }));
vi.mock('@/lib/channel-binding', () => ({ consumeClientChannelInvite: vi.fn() }));
vi.mock('@/lib/client-workflow', () => ({
    sessionActionToken: vi.fn(), sessionActionTokenExpiry: vi.fn(), personalClientToken: vi.fn(),
}));
vi.mock('@/lib/telegram-proxy', () => ({ telegramSendAgent: () => undefined }));

// Подменяем Telegraf: собираем, на что бот подписался, и вызываем руками.
type Handler = (ctx: unknown) => Promise<unknown>;
const onHandlers: { filter: unknown; handler: Handler }[] = [];
const actionHandlers: { pattern: RegExp; handler: Handler }[] = [];

vi.mock('telegraf', () => {
    class FakeTelegraf {
        telegram = { sendMessage: vi.fn() };
        command() {}
        start() {}
        hears() {}
        on(filter: unknown, handler: Handler) { onHandlers.push({ filter, handler }); }
        action(pattern: RegExp, handler: Handler) { actionHandlers.push({ pattern, handler }); }
    }
    return {
        Telegraf: FakeTelegraf,
        Context: class {},
        Markup: {
            inlineKeyboard: (rows: unknown) => ({ reply_markup: { inline_keyboard: rows } }),
            button: {
                callback: (label: string, payload: string) => ({ text: label, callback_data: payload }),
                webApp: (label: string, url: string) => ({ text: label, url }),
                url: (label: string, url: string) => ({ text: label, url }),
            },
            keyboard: () => ({ resize: () => ({}) }),
        },
    };
});
vi.mock('telegraf/filters', () => ({ message: (kind: string) => `filter:${kind}` }));

beforeEach(async () => {
    vi.clearAllMocks();
    onHandlers.length = 0;
    actionHandlers.length = 0;
    vi.resetModules();
    process.env.TELEGRAM_BOT_TOKEN = 'test-token';
    await import('../src/lib/telegram-bot');
});

function contactHandler(): Handler {
    const found = onHandlers.find((h) => h.filter === 'filter:contact');
    if (!found) throw new Error('обработчик message(contact) не зарегистрирован');
    return found.handler;
}

function intakeActionHandler(): Handler {
    const found = actionHandlers.find((h) => h.pattern.source.includes('intake_'));
    if (!found) throw new Error('обработчик кнопок intake_ не зарегистрирован');
    return found.handler;
}

const CONTACT = { phone_number: '+79161234567', first_name: 'Анна', last_name: 'Волкова' };

describe('Telegram — пересланный контакт', () => {
    it('бот подписан на message(contact)', () => {
        expect(() => contactHandler()).not.toThrow();
    });

    it('контакт уходит в разбор с источником telegram', async () => {
        previewContactIntake.mockResolvedValue({ kind: 'not_a_psychologist' });
        const reply = vi.fn();
        await contactHandler()({ from: { id: 111 }, message: { contact: CONTACT }, reply });

        expect(previewContactIntake).toHaveBeenCalledWith({
            source: 'telegram',
            senderChatId: '111',
            contact: CONTACT,
        });
    });

    it('чужому человеку бот молчит', async () => {
        previewContactIntake.mockResolvedValue({ kind: 'not_a_psychologist' });
        const reply = vi.fn();
        await contactHandler()({ from: { id: 111 }, message: { contact: CONTACT }, reply });
        expect(reply).not.toHaveBeenCalled();
    });

    it('специалисту показывается разбор с кнопками, карточка НЕ создаётся', async () => {
        previewContactIntake.mockResolvedValue({
            kind: 'new',
            contact: { name: 'Анна Волкова', phone: '+79161234567' },
            draftId: 'draft-1',
        });
        const reply = vi.fn();
        await contactHandler()({ from: { id: 111 }, message: { contact: CONTACT }, reply });

        expect(reply).toHaveBeenCalledTimes(1);
        const [text, markup] = reply.mock.calls[0];
        expect(text).toContain('Анна Волкова');
        const payloads = markup.reply_markup.inline_keyboard.flat().map((b: { callback_data: string }) => b.callback_data);
        expect(payloads).toContain('intake_ok_draft-1');
        expect(payloads).toContain('intake_no_draft-1');
        expect(commitContactIntake).not.toHaveBeenCalled();
    });

    it('кнопка «Завести» создаёт клиента', async () => {
        userFindUnique.mockResolvedValue({ id: 'psy-1' });
        commitContactIntake.mockResolvedValue({ kind: 'created', clientName: 'Анна Волкова' });

        const ctx = {
            from: { id: 111 },
            match: ['intake_ok_draft-1', 'ok', 'draft-1'],
            answerCbQuery: vi.fn(),
            editMessageReplyMarkup: vi.fn().mockResolvedValue(undefined),
            reply: vi.fn(),
        };
        await intakeActionHandler()(ctx);

        expect(commitContactIntake).toHaveBeenCalledWith({
            draftId: 'draft-1',
            psychologistId: 'psy-1',
            action: 'create',
        });
        expect(ctx.reply).toHaveBeenCalled();
    });

    it('кнопка «Дополнить» дополняет, а не создаёт', async () => {
        userFindUnique.mockResolvedValue({ id: 'psy-1' });
        commitContactIntake.mockResolvedValue({ kind: 'filled', clientName: 'Анна', filled: ['phone'] });

        await intakeActionHandler()({
            from: { id: 111 },
            match: ['intake_fill_draft-1', 'fill', 'draft-1'],
            answerCbQuery: vi.fn(),
            editMessageReplyMarkup: vi.fn().mockResolvedValue(undefined),
            reply: vi.fn(),
        });

        expect(commitContactIntake).toHaveBeenCalledWith(expect.objectContaining({ action: 'fill' }));
    });

    // Так это сломалось на бою 07.09.2026. Специалист нажал «Завести»,
    // карточка появилась, а он не увидел НИЧЕГО: обновление пролежало у
    // Telegram в очереди, окно ответа на нажатие закрылось, answerCbQuery
    // отдал «400: query is too old» и оборвал обработчик на строке ПОСЛЕ
    // создания. Со стороны — «кнопка не реагирует», в базе — клиент есть.
    //
    // На российском адресе задержка доставки — не исключение, а обычное
    // дело, поэтому подтверждение нажатия обязано быть косметикой.
    it('окно ответа закрылось — работа всё равно делается и итог приходит', async () => {
        userFindUnique.mockResolvedValue({ id: 'psy-1' });
        commitContactIntake.mockResolvedValue({ kind: 'created', clientName: 'Анна Волкова' });

        const ctx = {
            from: { id: 111 },
            match: ['intake_ok_draft-1', 'ok', 'draft-1'],
            answerCbQuery: vi.fn().mockRejectedValue(
                new Error('400: Bad Request: query is too old and response timeout expired or query ID is invalid')),
            editMessageReplyMarkup: vi.fn().mockResolvedValue(undefined),
            reply: vi.fn(),
        };

        await expect(intakeActionHandler()(ctx)).resolves.not.toThrow();
        expect(commitContactIntake).toHaveBeenCalledWith(expect.objectContaining({ action: 'create' }));
        // Итог приходит НОВЫМ сообщением: оно уходит независимо от
        // возраста нажатия, в отличие от ответа на кнопку.
        expect(ctx.reply).toHaveBeenCalled();
    });

    // Порядок важен сам по себе: обращение к базе может съесть остаток
    // окна, поэтому подтверждаем до работы, а не после.
    it('нажатие подтверждается ДО обращения к базе', async () => {
        const order: string[] = [];
        userFindUnique.mockImplementation(async () => { order.push('db'); return { id: 'psy-1' }; });
        commitContactIntake.mockResolvedValue({ kind: 'created', clientName: 'Анна' });

        await intakeActionHandler()({
            from: { id: 111 },
            match: ['intake_ok_draft-1', 'ok', 'draft-1'],
            answerCbQuery: vi.fn(async () => { order.push('ack'); }),
            editMessageReplyMarkup: vi.fn().mockResolvedValue(undefined),
            reply: vi.fn(),
        });

        expect(order[0]).toBe('ack');
    });

    it('кнопку чужого человека не обслуживаем', async () => {
        userFindUnique.mockResolvedValue(null);
        const ctx = {
            from: { id: 222 },
            match: ['intake_ok_draft-1', 'ok', 'draft-1'],
            answerCbQuery: vi.fn(),
            editMessageReplyMarkup: vi.fn(),
            reply: vi.fn(),
        };
        await intakeActionHandler()(ctx);

        expect(commitContactIntake).not.toHaveBeenCalled();
        expect(ctx.reply).not.toHaveBeenCalled();
    });
});
