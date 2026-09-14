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

/**
 * Каналы клиента с учётом СТАРОГО хранилища привязки.
 *
 * Часть клиентов пришла до того, как chat id переехал в сам `DiaryClient`:
 * у них он лежит в связанной записи `TelegramClient.telegramUserId`. Эта
 * поправка была написана в одном месте — в рассылке напоминаний, — и любой
 * другой путь, читавший только `telegramChatId`, таким людям не писал вовсе.
 *
 * Отдельная тонкость, ради которой правило и вынесено сюда: у MAX-клиента
 * идентификатор начинается с `max_` и может лежать в том же поле. Если его
 * не распознать, человек получает «телеграм-сообщение» по MAX-адресу, то
 * есть не получает ничего.
 *
 * Функция чистая: на вход — то, что прочитали из базы, на выход — носитель
 * каналов для `pickChannel`.
 */
export function clientChannelBearer(client: {
    telegramChatId?: string | null;
    maxChatId?: string | null;
    preferredChannel?: string | null;
    telegramClient?: { telegramUserId?: string | null } | null;
} | null | undefined): ChannelBearer | null {
    if (!client) return null;

    const legacy = client.telegramClient?.telegramUserId || null;
    const telegramId = legacy || client.telegramChatId || null;
    const maxId = legacy?.startsWith('max_') ? legacy : (client.maxChatId || null);

    // Один и тот же id в обоих полях означает MAX-пользователя: считать его
    // ещё и телеграмным — это второй адрес того же человека.
    const telegram = maxId && telegramId === maxId ? null : telegramId;

    return { telegramChatId: telegram, maxChatId: maxId, preferredChannel: client.preferredChannel ?? null };
}
