/**
 * ПРАВИЛО ВЫБОРА МЕССЕНДЖЕРА — ЧИСТОЕ И ОТДЕЛЬНО ОТ ОТПРАВКИ.
 *
 * Вынесено из deliver.ts, потому что ответ на вопрос «куда писать» нужен в
 * местах, которым сама отправка не нужна вовсе: карточка клиента, состояние
 * каналов, разбор приглашения. Тянуть туда deliver.ts значит тянуть за ним
 * ботов и авторизацию — на одном таком импорте развалились тесты привязки.
 *
 * Здесь нет ни одного побочного импорта, и это условие, а не совпадение.
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
