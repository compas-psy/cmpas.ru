import { sendTelegramMessage } from '@/lib/telegram';
import { sendMaxMessage } from '@/lib/max-bot';

/**
 * ОДНО СОБЫТИЕ — ОДНО СООБЩЕНИЕ, В ОДИН КАНАЛ.
 *
 * Живой случай 10.09.2026. Учредитель завёл запись и получил ДВА одинаковых
 * сообщения — и как клиент, и как психолог. Причина: три пути отправки
 * держали два несовпадающих правила. Два шли и в Telegram, И в MAX:
 *
 *     if (tgId) await sendTelegramMessage(...)
 *     if (maxId) await sendMaxMessage(...)
 *
 * — у кого заведены оба канала, тот получал письмо дважды. Третий путь,
 * наоборот, выбирал один канал через else if. Ни один из трёх не был явно
 * неправ; неправым было то, что их три.
 *
 * Здесь один ответ на вопрос «куда писать» и одна отправка. Выбор канала —
 * ОСНОВНОЙ: тот, через которого человек пришёл последним. Так решил
 * учредитель, и это честнее алфавитного «сначала Telegram»: человек, живущий
 * в MAX, не должен получать письма в мессенджер, который не открывает.
 *
 * ВТОРАЯ ОБЯЗАННОСТЬ ЭТОГО МОДУЛЯ — РАЗМЕТКА.
 *
 * В MAX уходит РАЗМЕЧЕННЫЙ текст, а не расплющенный. У MAX нет разметки, но
 * есть кнопки со ссылкой, и sendMaxMessage вынимает ссылки из якорей в
 * кнопки. Три пути отдавали ему текст, где адрес уже был развёрнут в
 * «подпись: адрес» — вынимать было нечего, и учредитель видел голую ссылку
 * на полторы строки. Через эту дверь плоский текст в MAX не проходит.
 */

export type MessengerChannel = 'telegram' | 'max';

/** Всё, у кого есть мессенджеры: и клиент (DiaryClient), и специалист (User). */
export interface ChannelBearer {
    telegramChatId?: string | null;
    maxChatId?: string | null;
    /** Канал, через который человек пришёл последним. Пусто — правила ниже. */
    preferredChannel?: string | null;
}

export interface PickedChannel {
    channel: MessengerChannel;
    chatId: string;
}

/**
 * Куда писать этому человеку.
 *
 * Основной канал, если он назван и всё ещё привязан. Иначе — тот, который
 * есть. Оба сразу не возвращаются никогда: это и была ошибка.
 */
export function pickChannel(bearer: ChannelBearer | null | undefined): PickedChannel | null {
    if (!bearer) return null;
    const telegram = bearer.telegramChatId || null;
    const max = bearer.maxChatId || null;

    if (bearer.preferredChannel === 'telegram' && telegram) return { channel: 'telegram', chatId: telegram };
    if (bearer.preferredChannel === 'max' && max) return { channel: 'max', chatId: max };

    if (telegram) return { channel: 'telegram', chatId: telegram };
    if (max) return { channel: 'max', chatId: max };
    return null;
}

export interface DeliveryResult {
    /** Куда ушло. null — писать было некуда или отправка не удалась. */
    channel: MessengerChannel | null;
    sent: boolean;
}

/**
 * Отправить сообщение человеку — ровно один раз.
 *
 * `html` — текст С РАЗМЕТКОЙ Telegram (`<b>`, `<a href>`). Для MAX перевод
 * делает сама отправка: она же прячет ссылки в кнопки. Передавать сюда
 * заранее расплющенный текст нельзя — прятать будет нечего.
 */
export async function deliverMessage(
    bearer: ChannelBearer | null | undefined,
    html: string,
    buttons?: Array<Array<{ text: string; url?: string; payload?: string }>>,
): Promise<DeliveryResult> {
    const target = pickChannel(bearer);
    if (!target) return { channel: null, sent: false };

    try {
        if (target.channel === 'telegram') {
            // У кнопок два диалекта: Telegram зовёт поле callback_data, MAX —
            // payload. Перевод стоит здесь, чтобы вызывающий описывал кнопку
            // один раз и не помнил, в какой мессенджер она поедет.
            const inline = buttons?.map(row => row.map(button => (
                button.url ? { text: button.text, url: button.url } : { text: button.text, callback_data: button.payload || '' }
            )));
            const sent = await sendTelegramMessage(target.chatId, html, {
                parse_mode: 'HTML',
                disable_web_page_preview: true,
                ...(inline?.length ? { reply_markup: { inline_keyboard: inline } } : {}),
            });
            return { channel: 'telegram', sent: sent !== false };
        }
        await sendMaxMessage(target.chatId, html, buttons);
        return { channel: 'max', sent: true };
    } catch (error) {
        console.error(`[deliver] ${target.channel} send failed:`, error);
        return { channel: target.channel, sent: false };
    }
}
