/**
 * Аватарка клиента из подключённого им мессенджера.
 *
 * РЕШЕНИЕ УЧРЕДИТЕЛЯ: фотографию НЕ хранить. Хранится только идентификатор,
 * который у нас и так есть (telegramChatId, maxDialogId), а само изображение
 * запрашивается у мессенджера в момент показа и живёт ровно столько, сколько
 * нужно, чтобы его отдать.
 *
 * Почему так, а не «скачали и положили к себе». Фотография лица — это
 * биометрия по бытовому счёту и персональные данные по любому: сохранив её,
 * мы расширили бы состав обрабатываемых данных, а значит и политику, и
 * согласие, которые только что дозаполнялись. Ссылка на чужой сервис не
 * расширяет ничего: специалист и так видит это лицо в своём мессенджере,
 * рядом с перепиской с тем же человеком.
 *
 * Отсюда три правила, которые держит этот модуль:
 *   1. Ни одна функция здесь не пишет в базу.
 *   2. Токен бота не покидает сервер. У Telegram адрес файла содержит токен
 *      целиком, поэтому байты качаются здесь, а наружу уходит только
 *      картинка. Отдать этот адрес в браузер значило бы отдать доступ к боту.
 *   3. Нет аватарки — это НЕ ошибка. Человек мог закрыть фото настройками
 *      приватности, мессенджер мог не ответить. Тогда остаются инициалы.
 */

/** Что удалось получить: байты и тип. Никуда не сохраняется. */
export type AvatarImage = { bytes: ArrayBuffer; contentType: string };

export type AvatarSource =
    | { messenger: 'telegram'; id: string }
    | { messenger: 'max'; id: string };

export type ClientMessengerIds = {
    telegramChatId?: string | null;
    maxDialogId?: string | null;
};

/**
 * Откуда брать аватарку. Чистая функция — на ней держатся проверки.
 *
 * Порядок не случаен: «основной мессенджер» клиента — тот, через который
 * он на связи, и Telegram у нас первичный канал (через него идут и
 * уведомления, и самозапись). Если подключены оба, спрашиваем Telegram:
 * ходить за одной картинкой в два сервиса незачем.
 */
export function avatarSourceOf(client: ClientMessengerIds): AvatarSource | null {
    const telegram = client.telegramChatId?.trim();
    if (telegram) return { messenger: 'telegram', id: telegram };
    const max = client.maxDialogId?.trim();
    if (max) return { messenger: 'max', id: max };
    return null;
}

/**
 * Разрешённые типы картинки.
 *
 * Проверяется, а не пересылается как есть: ответ приходит с чужого сервера,
 * и Content-Type оттуда — это то, что нам сказали, а не то, что мы знаем.
 * Отдать браузеру чужой text/html под своим доменом — это XSS на своём же
 * origin, где лежит сессия специалиста.
 */
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

export function safeImageContentType(raw: string | null | undefined): string | null {
    if (!raw) return null;
    const type = raw.split(';')[0].trim().toLowerCase();
    return ALLOWED_TYPES.includes(type) ? type : null;
}

/**
 * Потолок размера. Аватарка — это десятки килобайт; всё, что сильно больше,
 * либо не аватарка, либо способ занять нам память.
 */
export const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

export type Fetcher = typeof fetch;

/**
 * Скачать картинку по адресу. Общая часть для обоих мессенджеров: проверка
 * типа и размера одна и та же, а адрес у каждого свой.
 */
export async function downloadImage(url: string, fetcher: Fetcher = fetch): Promise<AvatarImage | null> {
    try {
        const res = await fetcher(url);
        if (!res.ok) return null;
        const contentType = safeImageContentType(res.headers.get('content-type'));
        if (!contentType) return null;
        const length = Number(res.headers.get('content-length') ?? 0);
        if (length > MAX_AVATAR_BYTES) return null;
        const bytes = await res.arrayBuffer();
        if (bytes.byteLength > MAX_AVATAR_BYTES) return null;
        return { bytes, contentType };
    } catch {
        return null;
    }
}

export type TelegramConfig = { apiRoot: string; token: string };

/**
 * Аватарка из Telegram.
 *
 * Три шага, и все три на сервере: getUserProfilePhotos → getFile → скачать.
 * Берётся ПЕРВОЕ фото (самое свежее) в САМОМ МЕЛКОМ размере: на кружок
 * 44×44 больше не нужно, а каждый лишний килобайт — это чужой трафик и наше
 * ожидание.
 */
export async function fetchTelegramAvatar(
    userId: string,
    config: TelegramConfig,
    fetcher: Fetcher = fetch,
): Promise<AvatarImage | null> {
    const api = `${config.apiRoot}/bot${config.token}`;
    try {
        const photosRes = await fetcher(`${api}/getUserProfilePhotos?user_id=${encodeURIComponent(userId)}&limit=1`);
        if (!photosRes.ok) return null;
        const photos = await photosRes.json();
        // Пусто — это норма: человек закрыл фото настройками приватности.
        const sizes: Array<{ file_id?: string; width?: number }> = photos?.result?.photos?.[0] ?? [];
        if (!Array.isArray(sizes) || sizes.length === 0) return null;
        const smallest = [...sizes].sort((a, b) => (a.width ?? 0) - (b.width ?? 0))[0];
        if (!smallest?.file_id) return null;

        const fileRes = await fetcher(`${api}/getFile?file_id=${encodeURIComponent(smallest.file_id)}`);
        if (!fileRes.ok) return null;
        const file = await fileRes.json();
        const path = file?.result?.file_path;
        if (typeof path !== 'string' || !path) return null;

        return await downloadImage(`${config.apiRoot}/file/bot${config.token}/${path}`, fetcher);
    } catch {
        return null;
    }
}

export type MaxConfig = { apiRoot: string; token: string };

/**
 * Аватарка из MAX.
 *
 * GET /chats/{chat_id} отдаёт для диалога поле dialog_with_user, а в нём —
 * avatar_url. Поэтому и нужен идентификатор ДИАЛОГА: user_id, которым мы
 * пишем человеку, для этого запроса не подходит.
 *
 * avatar_url — обычный публичный адрес картинки, но отдавать его в браузер
 * мы всё равно не будем: тогда адрес чужого CDN оказался бы в истории и
 * кэше браузера специалиста и жил бы там дольше показа. Качаем здесь, как и
 * у Telegram, — одна дорога у обоих.
 */
export async function fetchMaxAvatar(
    dialogId: string,
    config: MaxConfig,
    fetcher: Fetcher = fetch,
): Promise<AvatarImage | null> {
    try {
        const res = await fetcher(`${config.apiRoot}/chats/${encodeURIComponent(dialogId)}`, {
            headers: { Authorization: config.token },
        });
        if (!res.ok) return null;
        const chat = await res.json();
        const url = chat?.dialog_with_user?.avatar_url;
        if (typeof url !== 'string' || !url.startsWith('https://')) return null;
        return await downloadImage(url, fetcher);
    } catch {
        return null;
    }
}
