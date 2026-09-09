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
    /** Известен диалог MAX — можно спрашивать аватарку сразу. */
    | { messenger: 'max'; id: string }
    /** Известен только пользователь MAX — диалог придётся выяснить. */
    | { messenger: 'max-user'; id: string };

export type ClientMessengerIds = {
    telegramChatId?: string | null;
    /** Идентификатор пользователя MAX: им пишут человеку. */
    maxChatId?: string | null;
    /** Идентификатор ДИАЛОГА MAX: по нему спрашивают аватарку. */
    maxDialogId?: string | null;
};

/**
 * Откуда брать аватарку — ВСЕ подключённые мессенджеры, по порядку.
 *
 * ПОЧЕМУ СПИСОК, А НЕ ОДИН. Первая версия возвращала первый подходящий и
 * ставила Telegram впереди. Учредитель спросил ровно про это: «а пытается
 * ли вытянуть иконку из Макса, если он основной?» — нет, не пытался. У
 * клиента, подключённого к обоим, спрашивали Telegram, где фотографии могло
 * не быть вовсе, и на этом останавливались.
 *
 * ПОЧЕМУ MAX ПЕРВЫЙ. Не по симпатии, а по тому же правилу, по которому
 * продукт выбирает канал для сообщений: getClientChannels отдаёт
 * recommendedChannel = max, когда MAX подключён (src/lib/channel-binding.ts).
 * Основной мессенджер — это тот, которым человеку пишут; логично и лицо
 * брать оттуда же.
 *
 * MAX попадает в список и по maxChatId — без известного диалога. Диалог
 * тогда придётся выяснить у самого MAX, но это лучше, чем не пытаться: до
 * этой правки аватарка MAX не работала вовсе, потому что maxDialogId
 * заполняется только со следующим сообщением клиента боту, и на боевом
 * сервере он был пуст у всех.
 */
export function avatarSourcesOf(client: ClientMessengerIds): AvatarSource[] {
    const sources: AvatarSource[] = [];

    const maxDialog = client.maxDialogId?.trim();
    const maxUser = client.maxChatId?.trim();
    if (maxDialog) sources.push({ messenger: 'max', id: maxDialog });
    else if (maxUser) sources.push({ messenger: 'max-user', id: maxUser });

    const telegram = client.telegramChatId?.trim();
    if (telegram) sources.push({ messenger: 'telegram', id: telegram });

    return sources;
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
 * Срок ожидания мессенджера.
 *
 * Не перестраховка. Проба с боевого сервера: прямого хода до
 * api.telegram.org нет вовсе — запрос висит и обрывается через 15 секунд по
 * таймауту операционной системы. Без своего срока браузер специалиста ждал
 * бы эти секунды на КАЖДОМ кружке, прежде чем показать инициалы, и список
 * клиентов выглядел бы намертво зависшим.
 *
 * Аватарка — украшение: лучше быстро показать инициалы, чем долго ждать
 * фотографию.
 */
export const MESSENGER_TIMEOUT_MS = 4000;

/** Запрос со сроком. Истёк — это «аватарки нет», а не исключение наружу. */
async function withTimeout(fetcher: Fetcher, url: string, init?: RequestInit): Promise<Response | null> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), MESSENGER_TIMEOUT_MS);
    try {
        return await fetcher(url, { ...(init ?? {}), signal: controller.signal });
    } catch {
        return null;
    } finally {
        clearTimeout(timer);
    }
}

/**
 * Скачать картинку по адресу. Общая часть для обоих мессенджеров: проверка
 * типа и размера одна и та же, а адрес у каждого свой.
 */
export async function downloadImage(url: string, fetcher: Fetcher = fetch): Promise<AvatarImage | null> {
    try {
        const res = await withTimeout(fetcher, url);
        if (!res || !res.ok) return null;
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
/**
 * Почему за фотографией сходили и вернулись ни с чем.
 *
 * Один общий «пусто» уже дважды увёл меня в неверную догадку: на экране и в
 * журнале «у человека нет фото», «Telegram не ответил» и «файл не забрался»
 * выглядели одинаково. Шаг называется, чтобы следующий раз отвечал журнал, а
 * не предположение.
 */
export type AvatarMiss =
    /** Telegram не ответил или ответил ошибкой на список фотографий. */
    | 'tg_photos_unreachable'
    /** Telegram ответил, фотографий у человека нет (или закрыты). */
    | 'tg_no_photos'
    /** Не удалось получить путь к файлу. */
    | 'tg_file_unreachable'
    /** Путь есть, а сам файл не забрался или пришёл не картинкой. */
    | 'tg_download_failed'
    /** MAX не ответил или у диалога нет аватарки. */
    | 'max_no_avatar'
    /** Не нашли диалог MAX с этим человеком. */
    | 'max_no_dialog';

export type AvatarAttempt =
    | { image: AvatarImage; miss?: undefined }
    | { image: null; miss: AvatarMiss };

export async function fetchTelegramAvatar(
    userId: string,
    config: TelegramConfig,
    fetcher: Fetcher = fetch,
): Promise<AvatarImage | null> {
    return (await tryTelegramAvatar(userId, config, fetcher)).image;
}

/** То же, но с названной причиной отказа. */
export async function tryTelegramAvatar(
    userId: string,
    config: TelegramConfig,
    fetcher: Fetcher = fetch,
): Promise<AvatarAttempt> {
    const api = `${config.apiRoot}/bot${config.token}`;
    try {
        const photosRes = await withTimeout(fetcher, `${api}/getUserProfilePhotos?user_id=${encodeURIComponent(userId)}&limit=1`);
        if (!photosRes || !photosRes.ok) return { image: null, miss: 'tg_photos_unreachable' };
        const photos = await photosRes.json();
        // Пусто — это норма: человек закрыл фото настройками приватности.
        const sizes: Array<{ file_id?: string; width?: number }> = photos?.result?.photos?.[0] ?? [];
        if (!Array.isArray(sizes) || sizes.length === 0) return { image: null, miss: 'tg_no_photos' };
        const smallest = [...sizes].sort((a, b) => (a.width ?? 0) - (b.width ?? 0))[0];
        if (!smallest?.file_id) return { image: null, miss: 'tg_no_photos' };

        const fileRes = await withTimeout(fetcher, `${api}/getFile?file_id=${encodeURIComponent(smallest.file_id)}`);
        if (!fileRes || !fileRes.ok) return { image: null, miss: 'tg_file_unreachable' };
        const file = await fileRes.json();
        const path = file?.result?.file_path;
        if (typeof path !== 'string' || !path) return { image: null, miss: 'tg_file_unreachable' };

        const image = await downloadImage(`${config.apiRoot}/file/bot${config.token}/${path}`, fetcher);
        return image ? { image } : { image: null, miss: 'tg_download_failed' };
    } catch {
        return { image: null, miss: 'tg_photos_unreachable' };
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
/**
 * Найти ДИАЛОГ MAX по идентификатору пользователя.
 *
 * MAX отдаёт аватарку через GET /chats/{chat_id} — по диалогу, а не по
 * пользователю. Диалог приходит во входящем сообщении и запоминается, но у
 * давно привязанных клиентов его нет: на боевом сервере он был пуст у ВСЕХ,
 * и аватарка MAX не работала ни у кого.
 *
 * Поэтому спрашиваем список чатов бота и ищем среди них диалог с этим
 * человеком. Дорого — поэтому результат вызывающий обязан запомнить, чтобы
 * второй раз не искать.
 *
 * Страницы ограничены: у бота чатов столько же, сколько у него собеседников,
 * и бесконечно листать чужой сервис ради украшения незачем.
 */
export const MAX_DIALOG_SCAN_PAGES = 5;
export const MAX_DIALOG_PAGE_SIZE = 100;

export async function resolveMaxDialogId(
    userId: string,
    config: MaxConfig,
    fetcher: Fetcher = fetch,
): Promise<string | null> {
    const wanted = String(userId).replace(/^max_/, '');
    let marker: string | null = null;

    for (let page = 0; page < MAX_DIALOG_SCAN_PAGES; page++) {
        const query = new URLSearchParams({ count: String(MAX_DIALOG_PAGE_SIZE) });
        if (marker) query.set('marker', marker);
        const res = await withTimeout(fetcher, `${config.apiRoot}/chats?${query.toString()}`, {
            headers: { Authorization: config.token },
        });
        if (!res || !res.ok) return null;

        let body: {
            chats?: Array<{ chat_id?: number | string; type?: string; dialog_with_user?: { user_id?: number | string } | null }>;
            marker?: number | string | null;
        };
        try {
            body = await res.json();
        } catch {
            return null;
        }

        for (const chat of body?.chats ?? []) {
            if (chat?.type !== 'dialog') continue;
            const withUser = chat?.dialog_with_user?.user_id;
            if (withUser !== undefined && withUser !== null && String(withUser) === wanted) {
                return chat.chat_id === undefined || chat.chat_id === null ? null : String(chat.chat_id);
            }
        }

        if (body?.marker === undefined || body?.marker === null) return null;
        marker = String(body.marker);
    }
    return null;
}

export async function fetchMaxAvatar(
    dialogId: string,
    config: MaxConfig,
    fetcher: Fetcher = fetch,
): Promise<AvatarImage | null> {
    try {
        const res = await withTimeout(fetcher, `${config.apiRoot}/chats/${encodeURIComponent(dialogId)}`, {
            headers: { Authorization: config.token },
        });
        if (!res || !res.ok) return null;
        const chat = await res.json();
        const url = chat?.dialog_with_user?.avatar_url;
        if (typeof url !== 'string' || !url.startsWith('https://')) return null;
        return await downloadImage(url, fetcher);
    } catch {
        return null;
    }
}
