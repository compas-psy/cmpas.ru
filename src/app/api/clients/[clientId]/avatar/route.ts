/**
 * Аватарка клиента: GET /api/clients/<id>/avatar
 *
 * Отдаёт картинку из мессенджера, к которому клиент подключён. Ничего не
 * сохраняет: у нас лежит только идентификатор, который был и до этой правки
 * (см. src/lib/clients/avatar.ts — там расписано, почему именно так).
 *
 * Маршрут отвечает и вебу, и Android: у веба сессия в куке, у приложения
 * Bearer-токен. Один адрес на оба — иначе картинку пришлось бы получать
 * двумя разными способами и чинить потом тоже дважды.
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
import { nodeFetch, telegramSendAgent } from '@/lib/telegram-proxy';

export const dynamic = 'force-dynamic';

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
 */
const noAvatar = () => new NextResponse(null, {
    status: 404,
    headers: { 'Cache-Control': 'private, max-age=300' },
});

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ clientId: string }> },
) {
    const psychologistId = await requesterId(req);
    if (!psychologistId) return new NextResponse(null, { status: 401 });

    const { clientId } = await params;

    // Идентификатор в адресе — не разрешение (Task 1). Запрос сразу сужен
    // до клиентов этого специалиста: чужая карточка отвечает так же, как
    // несуществующая, и по ответу их не различить.
    const client = await db.diaryClient.findFirst({
        where: { id: clientId, psychologistId },
        select: { id: true, telegramChatId: true, maxDialogId: true },
    });
    if (!client) return noAvatar();

    const source = avatarSourceOf(client);
    if (!source) return noAvatar();

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

    if (!image) return noAvatar();

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
 * Telegram — той же дорогой, что и сообщения.
 *
 * Прямой fetch тут не годится: когда включён VPN-сайдкар, он включён
 * потому, что напрямую до api.telegram.org не достучаться. Аватарки ходили
 * бы мимо и молча не грузились — а выглядело бы это как «у клиентов нет
 * фотографий», а не как «мы ходим не той дорогой».
 *
 * Прокси остаётся добавкой: telegramSendAgent отдаёт агента, только если
 * флаг включён И проба через прокси прошла. Нет агента — обычный fetch.
 */
async function telegramFetcher(): Promise<typeof fetch> {
    try {
        const agent = await telegramSendAgent();
        if (!agent) return fetch;
        const nf = nodeFetch();
        return ((url: string, init?: Record<string, unknown>) =>
            nf(url, { ...(init ?? {}), agent })) as unknown as typeof fetch;
    } catch {
        return fetch;
    }
}

async function loadFromMessenger(source: { messenger: 'telegram' | 'max'; id: string }) {
    if (source.messenger === 'telegram') {
        const token = process.env.TELEGRAM_BOT_TOKEN;
        if (!token) return null;
        return fetchTelegramAvatar(source.id, {
            apiRoot: process.env.TELEGRAM_API_URL || 'https://api.telegram.org',
            token,
        }, await telegramFetcher());
    }
    const token = process.env.MAX_BOT_TOKEN;
    if (!token) return null;
    return fetchMaxAvatar(source.id, { apiRoot: 'https://platform-api2.max.ru', token });
}
