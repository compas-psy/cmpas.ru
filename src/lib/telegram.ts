/**
 * Базовые функции для отправки уведомлений в Telegram клиенту или психологу.
 * Поддержка HTTPS прокси через TELEGRAM_PROXY env var.
 */
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_PROXY = process.env.TELEGRAM_PROXY;
const TELEGRAM_API_URL = process.env.TELEGRAM_API_URL || 'https://api.telegram.org';

// Lazy-init proxy agent
let _proxyAgent: any = null;
function getProxyAgent() {
    if (!TELEGRAM_PROXY) return undefined;
    if (!_proxyAgent) {
        try {
            const { HttpsProxyAgent } = require('https-proxy-agent');
            _proxyAgent = new HttpsProxyAgent(TELEGRAM_PROXY);
        } catch { /* package not installed */ }
    }
    return _proxyAgent;
}

// Опции для кнопок
export type SendMessageOptions = {
    parse_mode?: string;
    disable_web_page_preview?: boolean;
    link_preview_options?: { is_disabled?: boolean };
    reply_markup?: {
        inline_keyboard: { text: string, callback_data?: string, url?: string, web_app?: { url: string } }[][];
    };
};

/**
 * Отправляет сообщение указанному пользователю Telegram (chatId).
 * Таймаут 10 секунд для предотвращения зависания.
 */
export async function sendTelegramMessage(chatId: string, text: string, options?: SendMessageOptions) {
    if (!TELEGRAM_BOT_TOKEN) {
        console.warn('[Telegram] Отсутствует TELEGRAM_BOT_TOKEN, отправка пропущена.');
        return;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    try {
        const url = `${TELEGRAM_API_URL}/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
        const body = {
            chat_id: chatId,
            text,
            parse_mode: 'HTML',
            disable_web_page_preview: true,
            link_preview_options: { is_disabled: true },
            ...options
        };

        const fetchOpts: any = {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
            signal: controller.signal,
        };

        // Use proxy agent if configured (for Russia/restricted networks)
        const agent = getProxyAgent();
        if (agent) {
            // Node.js fetch doesn't support agent directly,
            // use undici dispatcher or node-fetch. Fallback to default fetch.
            try {
                const nodeFetch = require('node-fetch');
                const res = await nodeFetch(url, { ...fetchOpts, agent });
                if (!res.ok) {
                    console.error('[Telegram] Ошибка при отправке сообщения:', await res.text());
                }
                return;
            } catch (e: any) {
                if (e.name === 'AbortError') throw e;
                // If node-fetch not available, fall through to default fetch
            }
        }

        const res = await fetch(url, fetchOpts);
        if (!res.ok) {
            console.error('[Telegram] Ошибка при отправке сообщения:', await res.text());
        }
    } catch (error: any) {
        if (error.name === 'AbortError') {
            console.error('[Telegram] Таймаут при отправке сообщения в chatId:', chatId);
        } else {
            console.error('[Telegram] Исключение при вызове API:', error);
        }
    } finally {
        clearTimeout(timeout);
    }
}
