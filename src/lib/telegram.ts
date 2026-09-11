/**
 * Базовые функции для отправки уведомлений в Telegram клиенту или психологу.
 * Прокси (VPN-тоннель, hysteria2) используется только когда админ-флаг telegram_vpn_proxy
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
 * Возвращает true/false об исходе отправки (O-260817-16, ReminderOutbox) —
 * раньше функция ничего не возвращала, и вызывающий код не мог узнать,
 * дошло ли сообщение, не разбирая консольные логи. Добавление возврата не
 * меняет поведение ни одного из существующих вызовов: все они либо не
 * используют результат вовсе, либо цепочкой `.catch()` — то и другое
 * совместимо с любым типом возврата.
 */
export async function sendTelegramMessage(chatId: string, text: string, options?: SendMessageOptions): Promise<boolean> {
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
                if (!res.ok) console.error('[Telegram] Ошибка при отправке сообщения:', await res.text());
                return res.ok;
            } catch (e: any) {
                // Proxy attempt failed (incl. timeout) — fall through to a DIRECT
                // send so a flaky VPN never silently drops a message.
                console.warn('[Telegram] proxy send failed, falling back to direct:', e?.message || e);
            }
        }

        const res = await fetch(url, fetchOpts);
        if (!res.ok) console.error('[Telegram] Ошибка при отправке сообщения:', await res.text());
        return res.ok;
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

/**
 * Картинка в переписку — для кода оплаты.
 *
 * Ссылка на картинку требует от человека её открыть; код, пришедший
 * картинкой, он наводит камерой соседнего телефона и платит. Ради одного
 * этого случая функция и нужна.
 *
 * Отправляется телом запроса, а не адресом: адрес пришлось бы сделать
 * публичным, чтобы его достал Telegram, — то есть выложить наружу ссылку
 * оплаты конкретного специалиста.
 */
export async function sendTelegramPhoto(
    chatId: string,
    photo: Buffer,
    caption?: string,
): Promise<boolean> {
    if (!TELEGRAM_BOT_TOKEN) {
        console.warn('[Telegram] Отсутствует TELEGRAM_BOT_TOKEN, отправка картинки пропущена.');
        return false;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    try {
        const form = new FormData();
        form.append('chat_id', chatId);
        if (caption) form.append('caption', caption);
        form.append('photo', new Blob([new Uint8Array(photo)], { type: 'image/png' }), 'qr.png');

        const url = `${TELEGRAM_API_URL}/bot${TELEGRAM_BOT_TOKEN}/sendPhoto`;
        const res = await fetch(url, { method: 'POST', body: form, signal: controller.signal });
        if (!res.ok) console.error('[Telegram] Ошибка при отправке картинки:', await res.text());
        return res.ok;
    } catch (error: unknown) {
        // Код оплаты — не единственный способ заплатить: ссылка ушла
        // текстом рядом. Поэтому неудача здесь не роняет отправку целиком.
        console.error('[Telegram] Исключение при отправке картинки:', error);
        return false;
    } finally {
        clearTimeout(timeout);
    }
}
