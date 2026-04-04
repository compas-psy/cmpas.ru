/**
 * Базовые функции для отправки уведомлений через MAX мессенджер (mail.ru).
 * MAX использует тот же Bot API протокол, что и Telegram, но с другим endpoint.
 */
const MAX_BOT_TOKEN = process.env.MAX_BOT_TOKEN;
const MAX_API_ROOT = 'https://botapi.max.ru';

export type SendMaxMessageOptions = {
    reply_markup?: {
        inline_keyboard: { text: string; callback_data?: string; url?: string }[][];
    };
};

/**
 * Отправляет сообщение пользователю MAX.
 * chatId хранится в поле maxChatId у User (для психологов)
 * или как telegramChatId с префиксом max_ у DiaryClient/TelegramClient (для клиентов).
 */
export async function sendMaxMessage(chatId: string, text: string, options?: SendMaxMessageOptions) {
    if (!MAX_BOT_TOKEN) {
        console.warn('[MAX] Отсутствует MAX_BOT_TOKEN, отправка пропущена.');
        return;
    }

    // chatId может быть raw ID или max_123456 — отправляем только числовую часть
    const rawId = chatId.startsWith('max_') ? chatId.replace('max_', '') : chatId;

    try {
        const url = `${MAX_API_ROOT}/bot${MAX_BOT_TOKEN}/sendMessage`;
        const body = {
            chat_id: rawId,
            text,
            parse_mode: 'HTML',
            ...options,
        };

        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });

        if (!res.ok) {
            console.error('[MAX] Ошибка отправки:', await res.text());
        }
    } catch (error) {
        console.error('[MAX] Исключение при вызове API:', error);
    }
}
