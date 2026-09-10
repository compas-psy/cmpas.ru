// Одно событие — одно сообщение, в один канал.
//
// Живой случай 10.09.2026. Учредитель завёл запись и получил ДВА одинаковых
// сообщения — и как клиент, и как психолог. Причина: три пути отправки
// держали два несовпадающих правила. Два шли и в Telegram, И в MAX:
//
//     if (tgId) await sendTelegramMessage(...)
//     if (maxId) await sendMaxMessage(...)
//
// Третий, наоборот, выбирал один канал через else if. Ни один из трёх не был
// явно неправ; неправым было то, что их три.
//
// Вторая проверка здесь — про разметку: в MAX должен уходить РАЗМЕЧЕННЫЙ
// текст. Ссылки там прячутся в кнопки, и делает это сама отправка; если
// отдать ей заранее расплющенный текст, прятать будет нечего, и человек
// увидит голый адрес на полторы строки.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const sendTelegramMessage = vi.fn().mockResolvedValue(true);
const sendMaxMessage = vi.fn().mockResolvedValue(undefined);
vi.mock('@/lib/telegram', () => ({ sendTelegramMessage: (...a: unknown[]) => sendTelegramMessage(...a) }));
vi.mock('@/lib/max-bot', () => ({ sendMaxMessage: (...a: unknown[]) => sendMaxMessage(...a) }));

beforeEach(() => {
    vi.clearAllMocks();
    sendTelegramMessage.mockResolvedValue(true);
    sendMaxMessage.mockResolvedValue(undefined);
});

describe('выбор канала', () => {
    it('оба мессенджера — пишем в основной, а не в оба', async () => {
        const { pickChannel } = await import('@/lib/messaging/deliver');

        expect(pickChannel({ telegramChatId: '111', maxChatId: 'max_222', preferredChannel: 'max' }))
            .toEqual({ channel: 'max', chatId: 'max_222' });
    });

    it('основной назван, но отвязан — пишем в тот, что остался', async () => {
        const { pickChannel } = await import('@/lib/messaging/deliver');

        expect(pickChannel({ telegramChatId: '111', maxChatId: null, preferredChannel: 'max' }))
            .toEqual({ channel: 'telegram', chatId: '111' });
    });

    it('основной не назван — прежний порядок: Telegram, иначе MAX', async () => {
        // Так привязаны все, кто пришёл до появления этого поля. Молча менять
        // им канал нельзя.
        const { pickChannel } = await import('@/lib/messaging/deliver');

        expect(pickChannel({ telegramChatId: '111', maxChatId: 'max_222' })?.channel).toBe('telegram');
        expect(pickChannel({ telegramChatId: null, maxChatId: 'max_222' })?.channel).toBe('max');
    });

    it('мессенджера нет — писать некуда', async () => {
        const { pickChannel } = await import('@/lib/messaging/deliver');
        expect(pickChannel({ telegramChatId: null, maxChatId: null })).toBeNull();
        expect(pickChannel(null)).toBeNull();
    });
});

describe('отправка', () => {
    it('у кого оба канала — получает ОДНО сообщение', async () => {
        const { deliverMessage } = await import('@/lib/messaging/deliver');

        await deliverMessage({ telegramChatId: '111', maxChatId: 'max_222' }, 'Привет');

        expect(sendTelegramMessage).toHaveBeenCalledTimes(1);
        expect(sendMaxMessage).not.toHaveBeenCalled();
    });

    it('в MAX уходит РАЗМЕЧЕННЫЙ текст — иначе прятать ссылку не во что', async () => {
        const { deliverMessage } = await import('@/lib/messaging/deliver');
        const html = 'Управлять записями можно <a href="https://cmpas.ru/bot/book/psy-1">здесь</a>.';

        await deliverMessage({ telegramChatId: null, maxChatId: 'max_222' }, html);

        expect(sendMaxMessage).toHaveBeenCalledWith('max_222', html, undefined);
    });

    it('кнопки описываются один раз — диалект подставляется по каналу', async () => {
        // Telegram зовёт поле callback_data, MAX — payload.
        const { deliverMessage } = await import('@/lib/messaging/deliver');
        const buttons = [[{ text: 'Подтверждаю', payload: 'confirm_1' }]];

        await deliverMessage({ telegramChatId: '111', maxChatId: null }, 'Текст', buttons);

        const options = sendTelegramMessage.mock.calls[0][2] as Record<string, any>;
        expect(options.reply_markup.inline_keyboard[0][0]).toEqual({ text: 'Подтверждаю', callback_data: 'confirm_1' });
    });

    it('ссылочная кнопка остаётся ссылкой в обоих мессенджерах', async () => {
        const { deliverMessage } = await import('@/lib/messaging/deliver');
        const buttons = [[{ text: 'Перенести', url: 'https://cmpas.ru/x' }]];

        await deliverMessage({ telegramChatId: '111', maxChatId: null }, 'Текст', buttons);
        const options = sendTelegramMessage.mock.calls[0][2] as Record<string, any>;
        expect(options.reply_markup.inline_keyboard[0][0]).toEqual({ text: 'Перенести', url: 'https://cmpas.ru/x' });

        await deliverMessage({ telegramChatId: null, maxChatId: 'max_222' }, 'Текст', buttons);
        expect(sendMaxMessage).toHaveBeenCalledWith('max_222', 'Текст', buttons);
    });

    it('писать некуда — отправки нет и падения нет', async () => {
        const { deliverMessage } = await import('@/lib/messaging/deliver');

        const result = await deliverMessage({ telegramChatId: null, maxChatId: null }, 'Привет');

        expect(result).toEqual({ channel: null, sent: false });
        expect(sendTelegramMessage).not.toHaveBeenCalled();
        expect(sendMaxMessage).not.toHaveBeenCalled();
    });

    it('отказ мессенджера не роняет вызывающего, но и не выдаётся за успех', async () => {
        sendMaxMessage.mockRejectedValueOnce(new Error('MAX недоступен'));
        const { deliverMessage } = await import('@/lib/messaging/deliver');

        const result = await deliverMessage({ telegramChatId: null, maxChatId: 'max_222' }, 'Привет');

        expect(result).toEqual({ channel: 'max', sent: false });
    });
});

describe('ни один путь отправки не пишет в оба канала сам', () => {
    it('в путях уведомлений не осталось парных отправок', async () => {
        // Проверка держит ПРИЧИНУ, а не форму: пока выбор канала сделан в
        // одном месте, удвоение вернуться не может. Как только кто-то снова
        // позовёт обе отправки подряд — здесь станет видно.
        const { readFileSync } = await import('fs');
        const paths = [
            'src/app/bot/actions.ts',
            'src/lib/cron/post-session-cascade.ts',
            'src/lib/cron/digest.ts',
            'src/app/diary/actions/notifications.ts',
        ];
        for (const path of paths) {
            const body = readFileSync(path, 'utf8');
            expect(body, `${path} должен звать общую отправку`).toContain('deliverMessage');
        }
    });
});
