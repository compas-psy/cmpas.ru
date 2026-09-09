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
    avatarSourceOf,
    fetchMaxAvatar,
    fetchTelegramAvatar,
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
    /** Сходили и не принесли: нет фотографии, закрыта, либо не ответили. */
    | 'empty';

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
        select: { id: true, telegramChatId: true, maxDialogId: true },
    });
    if (!client) return noAvatar('not_found');

    const source = avatarSourceOf(client);
    if (!source) return noAvatar('no_messenger');

    // Ключ кэша включает источник: клиент мог перепривязать мессенджер, и
    // тогда это уже другая аватарка, а не та же самая.
    const key = `${client.id}:${source.messenger}:${source.id}`;
    const cached = cache.get(key);

    let image: AvatarImage | null;
    if (cached) {
        image = cached.value;
    } else {
        image = await loadFromMessenger(source);
        cache.set(key, image);
    }

    if (!image) return noAvatar('empty');

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

async function loadFromMessenger(source: { messenger: 'telegram' | 'max'; id: string }) {
    if (source.messenger === 'telegram') {
        const token = process.env.TELEGRAM_BOT_TOKEN;
        if (!token) { console.log('[avatar] no_token telegram'); return null; }
        const config = {
            apiRoot: process.env.TELEGRAM_API_URL || 'https://api.telegram.org',
            token,
        };
        for (const road of await telegramRoads()) {
            const image = await fetchTelegramAvatar(source.id, config, road);
            if (image) return image;
        }
        return null;
    }
    const token = process.env.MAX_BOT_TOKEN;
    if (!token) { console.log('[avatar] no_token max'); return null; }
    return fetchMaxAvatar(source.id, { apiRoot: 'https://platform-api2.max.ru', token });
}
