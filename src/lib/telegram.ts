/**
 * Базовые функции для отправки уведомлений в Telegram клиенту или психологу
 */
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

// Опции для кнопок
export type SendMessageOptions = {
    reply_markup?: {
        inline_keyboard: { text: string, callback_data?: string, url?: string }[][];
    };
};

/**
 * Отправляет сообщение указанному пользователю Telegram (chatId).
 * 
 * @param chatId ID пользователя Telegram
 * @param text Текст сообщения
 * @param options Дополнительные параметры (клавиатура и др.)
 */
export async function sendTelegramMessage(chatId: string, text: string, options?: SendMessageOptions) {
    if (!TELEGRAM_BOT_TOKEN) {
        console.warn('[Telegram] Отсутствует TELEGRAM_BOT_TOKEN, отправка пропущена.');
        return;
    }

    try {
        const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
        const body = {
            chat_id: chatId,
            text,
            parse_mode: 'HTML',
            ...options
        };

        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        });

        if (!res.ok) {
            console.error('[Telegram] Ошибка при отправке сообщения:', await res.text());
        }

    } catch (error) {
        console.error('[Telegram] Исключение при вызоке API:', error);
    }
}
