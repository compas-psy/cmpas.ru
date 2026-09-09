/**
 * Аватарка клиента из его мессенджера.
 *
 * Решение учредителя: фотографию НЕ хранить — только идентификатор, который
 * у нас и так есть, а изображение спрашивать у мессенджера в момент показа.
 * Проверяется здесь поэтому не «функция вернула байты», а то, что делает эту
 * правку безопасной:
 *
 *   1. Токен бота не уходит наружу ни при каких обстоятельствах.
 *   2. Чужой Content-Type не пересылается как есть.
 *   3. Отсутствие аватарки — норма, а не ошибка.
 *   4. Ни одна функция модуля не пишет в базу.
 */

import { describe, it, expect, vi } from 'vitest';
import {
    avatarSourceOf,
    safeImageContentType,
    downloadImage,
    fetchTelegramAvatar,
    fetchMaxAvatar,
    MAX_AVATAR_BYTES,
    MESSENGER_TIMEOUT_MS,
} from '@/lib/clients/avatar';

const TELEGRAM = { apiRoot: 'https://api.telegram.org', token: 'ТОКЕН-БОТА' };
const MAX = { apiRoot: 'https://platform-api2.max.ru', token: 'ТОКЕН-MAX' };

const png = (size = 64) => ({
    ok: true,
    headers: new Headers({ 'content-type': 'image/png', 'content-length': String(size) }),
    arrayBuffer: async () => new ArrayBuffer(size),
});
const json = (body: unknown) => ({ ok: true, headers: new Headers(), json: async () => body });

describe('откуда берём аватарку', () => {
    it('нет мессенджера — источника нет', () => {
        expect(avatarSourceOf({})).toBeNull();
        expect(avatarSourceOf({ telegramChatId: null, maxDialogId: null })).toBeNull();
    });

    it('пустая строка не считается подключённым мессенджером', () => {
        // Пустые строки в этих полях в базе встречаются; без trim источник
        // «есть», и каждый показ уходил бы в мессенджер за заведомо ничем.
        expect(avatarSourceOf({ telegramChatId: '  ' })).toBeNull();
    });

    it('Telegram', () => {
        expect(avatarSourceOf({ telegramChatId: '12345' })).toEqual({ messenger: 'telegram', id: '12345' });
    });

    it('MAX по идентификатору ДИАЛОГА, а не пользователя', () => {
        // maxChatId (user_id) для запроса аватарки не годится: MAX отдаёт
        // dialog_with_user только по chat_id. Поэтому источник смотрит
        // именно на maxDialogId.
        expect(avatarSourceOf({ maxDialogId: '77' })).toEqual({ messenger: 'max', id: '77' });
    });

    it('подключены оба — спрашиваем Telegram, а не оба сразу', () => {
        expect(avatarSourceOf({ telegramChatId: '12345', maxDialogId: '77' }))
            .toEqual({ messenger: 'telegram', id: '12345' });
    });
});

describe('тип картинки', () => {
    it('картинки пропускаются, параметры отбрасываются', () => {
        expect(safeImageContentType('image/jpeg')).toBe('image/jpeg');
        expect(safeImageContentType('image/PNG; charset=binary')).toBe('image/png');
    });

    it('не картинка не пропускается', () => {
        // Отдать браузеру чужой text/html под своим доменом — это XSS на
        // origin, где лежит сессия специалиста.
        expect(safeImageContentType('text/html')).toBeNull();
        expect(safeImageContentType('image/svg+xml')).toBeNull();
        expect(safeImageContentType(null)).toBeNull();
        expect(safeImageContentType('')).toBeNull();
    });
});

describe('скачивание', () => {
    it('картинка приходит', async () => {
        const image = await downloadImage('https://example/a.png', vi.fn(async () => png()) as never);
        expect(image?.contentType).toBe('image/png');
    });

    it('слишком большой файл не берём даже без Content-Length', async () => {
        const fetcher = vi.fn(async () => ({
            ok: true,
            headers: new Headers({ 'content-type': 'image/png' }),
            arrayBuffer: async () => new ArrayBuffer(MAX_AVATAR_BYTES + 1),
        }));
        expect(await downloadImage('https://example/big.png', fetcher as never)).toBeNull();
    });

    it('обрыв сети — не исключение наружу, а «аватарки нет»', async () => {
        const fetcher = vi.fn(async () => { throw new Error('ECONNRESET'); });
        expect(await downloadImage('https://example/a.png', fetcher as never)).toBeNull();
    });
});

describe('Telegram', () => {
    it('берёт самый мелкий размер и скачивает его сам', async () => {
        const calls: string[] = [];
        const fetcher = vi.fn(async (url: string) => {
            calls.push(url);
            if (url.includes('getUserProfilePhotos')) {
                return json({ result: { photos: [[
                    { file_id: 'big', width: 640 },
                    { file_id: 'small', width: 160 },
                ]] } });
            }
            if (url.includes('getFile')) return json({ result: { file_path: 'photos/file_1.jpg' } });
            return png();
        });

        const image = await fetchTelegramAvatar('12345', TELEGRAM, fetcher as never);
        expect(image?.contentType).toBe('image/png');
        // На кружок 44×44 большой размер не нужен, а лишние килобайты — это
        // чужой трафик и наше ожидание.
        expect(calls.some(u => u.includes('file_id=small'))).toBe(true);
        expect(calls.some(u => u.includes('file_id=big'))).toBe(false);
    });

    it('человек закрыл фото — это норма, а не ошибка', async () => {
        const fetcher = vi.fn(async () => json({ result: { total_count: 0, photos: [] } }));
        expect(await fetchTelegramAvatar('12345', TELEGRAM, fetcher as never)).toBeNull();
    });

    it('телега ответила не тем — молчим, а не падаем', async () => {
        const fetcher = vi.fn(async () => json({ ok: false, description: 'Bad Request' }));
        expect(await fetchTelegramAvatar('12345', TELEGRAM, fetcher as never)).toBeNull();
    });
});

describe('MAX', () => {
    it('спрашивает диалог и качает avatar_url сам', async () => {
        const fetcher = vi.fn(async (url: string) => {
            if (url.includes('/chats/')) return json({ dialog_with_user: { avatar_url: 'https://cdn.max.ru/a.png' } });
            return png();
        });
        const image = await fetchMaxAvatar('77', MAX, fetcher as never);
        expect(image?.contentType).toBe('image/png');
        expect(fetcher.mock.calls[0][0]).toContain('/chats/77');
    });

    it('у диалога нет аватарки — норма', async () => {
        const fetcher = vi.fn(async () => json({ dialog_with_user: { user_id: 77 } }));
        expect(await fetchMaxAvatar('77', MAX, fetcher as never)).toBeNull();
    });

    it('не-https адрес не качаем', async () => {
        // Адрес приходит от чужого сервиса. http:// или file:// оттуда — это
        // не аватарка, а попытка сходить нашим сервером не туда.
        const fetcher = vi.fn(async (url: string) => {
            if (url.includes('/chats/')) return json({ dialog_with_user: { avatar_url: 'http://cdn.max.ru/a.png' } });
            return png();
        });
        expect(await fetchMaxAvatar('77', MAX, fetcher as never)).toBeNull();
        expect(fetcher).toHaveBeenCalledTimes(1);
    });
});

describe('срок ожидания', () => {
    it('мессенджер молчит — не ждём его вечно', async () => {
        // Проба с боевого сервера: прямого хода до api.telegram.org нет
        // вовсе, запрос просто висит. Без своего срока браузер специалиста
        // ждал бы на КАЖДОМ кружке, и список выглядел бы зависшим.
        // Молчащий сервер: ответа нет, пока запрос не отменят по сроку.
        const fetcher = vi.fn(async (...args: [string, RequestInit?]) => {
            await new Promise(wake => args[1]?.signal?.addEventListener('abort', wake));
            throw new Error('прервано по сроку');
        });
        const started = Date.now();
        const image = await downloadImage('https://example/hang.png', fetcher as never);
        expect(image).toBeNull();
        expect(Date.now() - started).toBeLessThan(MESSENGER_TIMEOUT_MS + 2000);
    }, 20000);

    it('срок передаётся запросу, а не только меряется', async () => {
        const fetcher = vi.fn(async (...args: [string, RequestInit?]) => { void args; return png(); });
        await downloadImage('https://example/a.png', fetcher as never);
        expect(fetcher.mock.calls[0][1]?.signal).toBeInstanceOf(AbortSignal);
    });
});

describe('токен бота наружу не уходит', () => {
    // Самое опасное место всей правки: адрес файла Telegram содержит токен
    // бота ЦЕЛИКОМ. Отдать этот адрес в браузер — это отдать доступ к боту,
    // то есть к переписке со всеми клиентами всех специалистов.
    it('ни в байтах, ни в типе ответа токена нет', async () => {
        const fetcher = vi.fn(async (url: string) => {
            if (url.includes('getUserProfilePhotos')) return json({ result: { photos: [[{ file_id: 'f', width: 160 }]] } });
            if (url.includes('getFile')) return json({ result: { file_path: 'photos/file_1.jpg' } });
            return png();
        });
        const image = await fetchTelegramAvatar('12345', TELEGRAM, fetcher as never);
        expect(image).not.toBeNull();
        expect(JSON.stringify(image)).not.toContain(TELEGRAM.token);
        expect(image!.contentType).not.toContain(TELEGRAM.token);
    });
});
