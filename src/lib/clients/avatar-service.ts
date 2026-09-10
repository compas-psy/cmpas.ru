/**
 * Аватарка клиента: обслуживание запроса, общее для веба и приложения.
 *
 * Отдаёт картинку из мессенджера, к которому клиент подключён. Ничего не
 * сохраняет: у нас лежит только идентификатор, который был и до этой правки
 * (см. src/lib/clients/avatar.ts — там расписано, почему именно так).
 *
 * Отвечает и вебу, и Android: у веба сессия в куке, у приложения
 * Bearer-токен. Адреса два — /api/clients/<id>/avatar и
 * /api/mobile/clients/<id>/avatar, — но код один: приложение строит все свои
 * запросы от одного настроенного адреса, и второй маршрут существует ровно
 * затем, чтобы эта настройка продолжала работать.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { auth } from '@/auth';
import { authenticateMobileRequest } from '@/lib/mobile-auth';
import {
    avatarSourcesOf,
    resolveMaxDialogId,
    type AvatarSource,
    fetchMaxAvatar,
    tryTelegramAvatar,
    type AvatarMiss,
    type AvatarImage,
} from '@/lib/clients/avatar';
import { AvatarCache } from '@/lib/clients/avatar-cache';
import { nodeFetch, telegramSendAgent, telegramProxyAgentUnchecked } from '@/lib/telegram-proxy';

/**
 * Кэш живёт в модуле, то есть в памяти процесса и только там. Значения
 * подобраны под список клиентов: у практика их 12–25, у кэша запас на
 * несколько практиков в одном процессе.
 */
const cache = new AvatarCache<AvatarImage>({
    maxEntries: 200,
    hitTtlMs: 6 * 60 * 60 * 1000,
    missTtlMs: 30 * 60 * 1000,
});

/** Кто спрашивает: сессия веба или токен приложения. */
async function requesterId(req: NextRequest): Promise<string | null> {
    const mobile = await authenticateMobileRequest(req);
    if (mobile) return mobile.userId;
    const session = await auth();
    return session?.user?.id ?? null;
}

/**
 * «Нет аватарки» — это 404, а не пустая картинка и не ошибка. Экран на 404
 * показывает инициалы, и это нормальный, а не аварийный вид.
 *
 * Но 404 на экране выглядит одинаково для СОВЕРШЕННО разных причин: клиент
 * не привязан к мессенджеру, у человека нет фотографии, мессенджер не
 * ответил. Не различать их — значит на вопрос «почему пусто» отвечать
 * «пусто». Поэтому причина называется в журнале, как это уже сделано у
 * подсказок адресов, и её вытаскивает scripts/db-doctor.sh.
 *
 * В журнал идёт ТОЛЬКО код причины. Ни имени, ни телефона, ни
 * идентификатора мессенджера: журнал читают люди, которым карточки этого
 * клиента не показывают.
 */
type NoAvatarReason =
    /** Карточки нет или она чужая. */
    | 'not_found'
    /** Мессенджер не подключён — идти не за чем. */
    | 'no_messenger'
    /** Ключ бота не задан: спросить нечем. */
    | 'no_token'
    /** Сходили и не принесли, но чем именно кончилось — сказано отдельно. */
    | 'empty'
    /** Названный шаг, на котором сорвалось (см. AvatarMiss). */
    | AvatarMiss;

const noAvatar = (reason: NoAvatarReason) => {
    console.log(`[avatar] ${reason}`);
    return new NextResponse(null, {
        status: 404,
        headers: { 'Cache-Control': 'private, max-age=300' },
    });
};

/**
 * Одна реализация на два адреса.
 *
 * Веб просит /api/clients/<id>/avatar, приложение —
 * /api/mobile/clients/<id>/avatar. Разные адреса нужны не из прихоти:
 * приложение собирает все свои запросы от ОДНОГО настроенного адреса
 * (BuildConfig.API_BASE_URL), и именно он подменяется на приёмочных сборках,
 * чтобы тест не ходил в боевые данные. Второй адрес — это способ оставить
 * эту подмену работающей, а не второй код.
 */
export async function serveClientAvatar(req: NextRequest, clientId: string) {
    const psychologistId = await requesterId(req);
    if (!psychologistId) return new NextResponse(null, { status: 401 });

    // Идентификатор в адресе — не разрешение (Task 1). Запрос сразу сужен
    // до клиентов этого специалиста: чужая карточка отвечает так же, как
    // несуществующая, и по ответу их не различить.
    const client = await db.diaryClient.findFirst({
        where: { id: clientId, psychologistId },
        select: { id: true, telegramChatId: true, maxChatId: true, maxDialogId: true },
    });
    if (!client) return noAvatar('not_found');

    // ВСЕ подключённые мессенджеры, а не первый попавшийся, и MAX впереди,
    // если он подключён: это и есть «основной» по правилу самого продукта
    // (см. avatarSourcesOf). До этого клиенту с двумя мессенджерами всегда
    // задавали вопрос Telegram и на его молчании останавливались.
    const sources = avatarSourcesOf(client);
    if (sources.length === 0) return noAvatar('no_messenger');

    for (const source of sources) {
        // Ключ кэша включает источник: клиент мог перепривязать мессенджер,
        // и тогда это уже другая аватарка, а не та же самая.
        const key = `${client.id}:${source.messenger}:${source.id}`;
        const cached = cache.get(key);

        if (cached) {
            if (cached.value) return imageResponse(cached.value);
            // Причина называется и у ЗАКЭШИРОВАННОГО промаха. Иначе в
            // журнале одно и то же событие выглядит по-разному в зависимости
            // от того, спрашивали ли этого клиента полчаса назад: 09.09 в
            // 19:41 причины были названы, а в 21:18 остался голый «empty» —
            // не потому, что что-то изменилось, а потому, что ответ пришёл
            // из кэша.
            console.log(`[avatar] ${cached.note ?? 'empty'} (из кэша)`);
            continue;
        }

        const attempt = await loadFromMessenger(source, client.id);
        cache.set(key, attempt.image, attempt.miss);
        if (attempt.image) return imageResponse(attempt.image);
        // Причина называется на КАЖДОЙ неудавшейся попытке: у клиента с
        // двумя мессенджерами их две, и «пусто» без разбора снова не дало бы
        // понять, кто именно смолчал.
        console.log(`[avatar] ${attempt.miss}`);
    }

    return noAvatar('empty');
}

function imageResponse(image: AvatarImage) {

    return new NextResponse(image.bytes, {
        status: 200,
        headers: {
            'Content-Type': image.contentType,
            'Content-Length': String(image.bytes.byteLength),
            // private — картинка чужого лица не должна оседать в общих
            // прокси между нами и специалистом.
            'Cache-Control': 'private, max-age=3600',
        },
    });
}

/**
 * Дороги до Telegram — ОБЕ, а не одна выбранная.
 *
 * Первая версия ходила той дорогой, которую выбирает отправка сообщений:
 * сайдкар, только если флаг включён И проба через него прошла, иначе
 * напрямую. На боевом сервере это дало «сходили и вернулись ни с чем» у
 * всех привязанных клиентов, и разобрать почему было нечем: на экране
 * «нет фотографии» и «пошли не той дорогой» выглядят одинаково.
 *
 * Поэтому здесь пробуются обе: сначала предпочтительная, потом вторая.
 * Первая, которая ответила, и выигрывает.
 *
 * Почему так МОЖНО именно тут и НЕЛЬЗЯ в отправке сообщений. У отправки
 * мёртвый тоннель однажды подвесил запрос на ~500 секунд и сломал привязку
 * — оттуда и флаг с пробой. У аватарки свой срок в 4 секунды и безвредный
 * отказ: не ответила ни одна дорога — человек видит инициалы, как и до
 * этой правки. Цена второй попытки — те же 4 секунды и только в случае,
 * когда первая и так ничего не принесла.
 */
async function telegramRoads(): Promise<Array<typeof fetch>> {
    const direct = fetch;

    let viaProxy: typeof fetch | null = null;
    try {
        const agent = telegramProxyAgentUnchecked();
        if (agent) {
            const nf = nodeFetch();
            viaProxy = ((url: string, init?: Record<string, unknown>) =>
                nf(url, { ...(init ?? {}), agent })) as unknown as typeof fetch;
        }
    } catch {
        viaProxy = null;
    }
    if (!viaProxy) return [direct];

    // Порядок — по тому, что отправка сообщений считает рабочим сейчас: если
    // она ходит через тоннель, начинать с прямой дороги значит каждый раз
    // ждать её отказа впустую.
    let preferProxy = false;
    try {
        preferProxy = Boolean(await telegramSendAgent());
    } catch {
        preferProxy = false;
    }
    return preferProxy ? [viaProxy, direct] : [direct, viaProxy];
}

/**
 * Сходить в мессенджер за фотографией.
 *
 * MAX ХОДИТ НАПРЯМУЮ, НЕ ЧЕРЕЗ ТУННЕЛЬ — решение учредителя. Сайдкар подняли
 * ради Telegram, и гонять через него чужой сервис незачем: это лишний узел
 * на пути и лишняя нагрузка на тоннель, от которого зависит доставка
 * сообщений. Проверено tests/client-avatar-route: у MAX не должно быть
 * клиента с агентом.
 */
async function loadFromMessenger(
    source: AvatarSource,
    clientId: string,
): Promise<{ image: AvatarImage | null; miss?: AvatarMiss }> {
    if (source.messenger === 'telegram') {
        const token = process.env.TELEGRAM_BOT_TOKEN;
        if (!token) { console.log('[avatar] no_token telegram'); return { image: null, miss: 'tg_photos_unreachable' }; }
        const config = {
            apiRoot: process.env.TELEGRAM_API_URL || 'https://api.telegram.org',
            token,
        };
        let miss: AvatarMiss = 'tg_photos_unreachable';
        for (const road of await telegramRoads()) {
            const attempt = await tryTelegramAvatar(source.id, config, road);
            if (attempt.image) return { image: attempt.image };
            miss = attempt.miss;
            // «Фотографий нет» — это ответ Telegram, а не отказ дороги:
            // вторая дорога принесёт тот же ответ, ходить незачем.
            if (miss === 'tg_no_photos') break;
        }
        return { image: null, miss };
    }
    const token = process.env.MAX_BOT_TOKEN;
    if (!token) { console.log('[avatar] no_token max'); return { image: null, miss: 'max_no_avatar' }; }
    const config = { apiRoot: MAX_API_ROOT, token };

    // Известен только пользователь — сначала выясняем диалог, иначе спросить
    // аватарку не у чего. Найденный диалог запоминаем: поиск листает список
    // чатов бота, и делать это на каждый показ кружка нельзя.
    if (source.messenger === 'max-user') {
        const dialogId = await resolveMaxDialogId(source.id, config);
        if (!dialogId) return { image: null, miss: 'max_no_dialog' };
        try {
            await db.diaryClient.update({ where: { id: clientId }, data: { maxDialogId: dialogId } });
        } catch {
            // Не записали — не беда: аватарку всё равно покажем, а в
            // следующий раз просто поищем снова.
        }
        const image = await fetchMaxAvatar(dialogId, config);
        return image ? { image } : { image: null, miss: 'max_no_avatar' };
    }

    const image = await fetchMaxAvatar(source.id, config);
    return image ? { image } : { image: null, miss: 'max_no_avatar' };
}

/**
 * Адрес MAX. Отдельной константой, потому что к нему ходят два места —
 * поиск диалога и сама аватарка.
 */
const MAX_API_ROOT = 'https://platform-api2.max.ru';
