/**
 * Базовые функции для отправки уведомлений в Telegram клиенту или психологу.
 * Прокси (mieru VPN) используется только когда админ-флаг telegram_vpn_proxy
 * включён И проба через прокси проходит — см. src/lib/telegram-proxy.ts.
 * Если прокси недоступен, отправка идёт напрямую (никогда не виснет).
 */
import { telegramSendAgent, nodeFetch } from '@/lib/telegram-proxy';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_API_URL = process.env.TELEGRAM_API_URL || 'https://api.telegram.org';

export type SendMessageOptions = {
    parse_mode?: string;
    disable_web_page_preview?: boolean;
    reply_markup?: {
        inline_keyboard: {
            text: string;
            callback_data?: string;
            url?: string;
            web_app?: { url: string };
            login_url?: {
                url: string;
                forward_text?: string;
                bot_username?: string;
                request_write_access?: boolean;
            };
        }[][];
    };
};

/**
 * Возвращает, дошло ли сообщение — раньше функция ничего не возвращала, и
 * вызывающий код не мог отличить успех от отказа API/сети иначе, чем
 * читая логи (O-260817-16: обязательный «результат» на каждую попытку в
 * outbox нельзя посчитать без этого сигнала).
 */
export async function sendTelegramMessage(
    chatId: string,
    text: string,
    options?: SendMessageOptions
): Promise<boolean> {
    if (!TELEGRAM_BOT_TOKEN) {
        console.warn('[Telegram] Отсутствует TELEGRAM_BOT_TOKEN, отправка пропущена.');
        return false;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    try {
        const url = `${TELEGRAM_API_URL}/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
        const body = {
            chat_id: chatId,
            text,
            parse_mode: 'HTML',
            ...options,
        };
        const fetchOpts: any = {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
            signal: controller.signal,
        };

        const agent = await telegramSendAgent();
        if (agent) {
            try {
                const f = nodeFetch();
                const res = await f(url, { ...fetchOpts, agent });
                if (!res.ok) {
                    console.error('[Telegram] Ошибка при отправке сообщения:', await res.text());
                    return false;
                }
                return true;
            } catch (e: any) {
                // Proxy attempt failed (incl. timeout) — fall through to a DIRECT
                // send so a flaky VPN never silently drops a message.
                console.warn('[Telegram] proxy send failed, falling back to direct:', e?.message || e);
            }
        }

        const res = await fetch(url, fetchOpts);
        if (!res.ok) {
            console.error('[Telegram] Ошибка при отправке сообщения:', await res.text());
            return false;
        }
        return true;
    } catch (error: any) {
        if (error.name === 'AbortError') {
            console.error('[Telegram] Таймаут при отправке сообщения в chatId:', chatId);
        } else {
            console.error('[Telegram] Исключение при вызове API:', error);
        }
        return false;
    } finally {
        clearTimeout(timeout);
    }
}
