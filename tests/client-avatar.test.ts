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
    avatarSourcesOf,
    safeImageContentType,
    downloadImage,
    fetchTelegramAvatar,
    tryTelegramAvatar,
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
    it('нет мессенджера — источников нет', () => {
        expect(avatarSourcesOf({})).toEqual([]);
        expect(avatarSourcesOf({ telegramChatId: null, maxChatId: null, maxDialogId: null })).toEqual([]);
    });

    it('пустая строка не считается подключённым мессенджером', () => {
        // Пустые строки в этих полях в базе встречаются; без trim источник
        // «есть», и каждый показ уходил бы в мессенджер за заведомо ничем.
        expect(avatarSourcesOf({ telegramChatId: '  ', maxChatId: '' })).toEqual([]);
    });

    it('Telegram', () => {
        expect(avatarSourcesOf({ telegramChatId: '12345' })).toEqual([{ messenger: 'telegram', id: '12345' }]);
    });

    it('MAX с известным диалогом спрашивается сразу', () => {
        expect(avatarSourcesOf({ maxDialogId: '77' })).toEqual([{ messenger: 'max', id: '77' }]);
    });

    it('MAX без диалога всё равно источник — диалог выясним', () => {
        // До этой правки такой клиент считался «без мессенджера»: диалог
        // заполняется только со следующим сообщением боту, и на боевом
        // сервере он был пуст у ВСЕХ. Аватарка MAX не работала ни у кого.
        expect(avatarSourcesOf({ maxChatId: 'max_500' })).toEqual([{ messenger: 'max-user', id: 'max_500' }]);
    });

    it('подключены оба — MAX первым, но Telegram остаётся запасным', () => {
        // «Основной мессенджер» — тот, которым человеку пишут: при
        // подключённом MAX продукт выбирает MAX (channel-binding). Логично и
        // лицо брать оттуда же. Но если MAX фотографии не дал, спрашиваем
        // Telegram, а не останавливаемся.
        expect(avatarSourcesOf({ telegramChatId: '12345', maxDialogId: '77' })).toEqual([
            { messenger: 'max', id: '77' },
            { messenger: 'telegram', id: '12345' },
        ]);
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

    /**
     * «Фотографий 0» — это не то же самое, что «фотографии нет».
     *
     * Учредитель показал карточку клиента с живой фотографией в Telegram, а
     * журнал на том же клиенте писал tg_no_photos: getUserProfilePhotos
     * вернул пусто. Значит ответ означал «этому боту не показали».
     *
     * getChat — другая ручка: она отдаёт сам чат, и фотография лежит там
     * отдельным полем. Спрашивается только при пустом первом ответе.
     */
    it('пусто у getUserProfilePhotos — спрашиваем getChat', async () => {
        const calls: string[] = [];
        const fetcher = vi.fn(async (url: string) => {
            calls.push(url);
            if (url.includes('getUserProfilePhotos')) return json({ result: { total_count: 0, photos: [] } });
            if (url.includes('getChat')) return json({ result: { photo: { small_file_id: 'chat-small', big_file_id: 'chat-big' } } });
            if (url.includes('getFile')) return json({ result: { file_path: 'photos/file_1.jpg' } });
            return png();
        });

        const image = await fetchTelegramAvatar('12345', TELEGRAM, fetcher as never);
        expect(image?.contentType).toBe('image/png');
        // Мелкий размер и здесь: кружок маленький.
        expect(calls.some(u => u.includes('file_id=chat-small'))).toBe(true);
        expect(calls.some(u => u.includes('file_id=chat-big'))).toBe(false);
    });

    it('первая дорога сработала — второй запрос не делается', async () => {
        const calls: string[] = [];
        const fetcher = vi.fn(async (url: string) => {
            calls.push(url);
            if (url.includes('getUserProfilePhotos')) return json({ result: { photos: [[{ file_id: 'f', width: 160 }]] } });
            if (url.includes('getFile')) return json({ result: { file_path: 'photos/file_1.jpg' } });
            return png();
        });

        expect(await fetchTelegramAvatar('12345', TELEGRAM, fetcher as never)).not.toBeNull();
        // Лишний поход к чужому сервису в удачном случае — это чужой предел
        // на бота, тот же, которым уходят уведомления.
        expect(calls.some(u => u.includes('getChat'))).toBe(false);
    });

    /**
     * ОТКАЗ ВТОРОЙ РУЧКИ — НЕ «ФОТОГРАФИИ НЕТ».
     *
     * Сервер, спрошенный про живого клиента, ответил «total_count: 1» —
     * фотография есть. Приложение на том же клиенте в ту же минуту писало
     * tg_no_photos. По журналу было не понять, кто из них прав: причина
     * называла ВЫВОД, а не то, из чего он сделан.
     *
     * Поэтому у неответившей getChat теперь своя причина, а рядом с любой
     * причиной идут числа, которые мессенджер реально вернул.
     */
    /**
     * ЧЕТЫРЁХ СЕКУНД НЕ ХВАТАЛО, И «НЕ ХВАТИЛО» БЫЛО НЕОТЛИЧИМО ОТ «СЛОМАЛОСЬ».
     *
     * У клиента с живой фотографией маршрут писал «photos=нет ответа» — и по
     * этой строке нельзя было понять, истёк ли срок или дорога не работает.
     * Пришлось идти на сервер и мерить руками: тот же запрос тем же туннелем
     * со сроком 20 секунд приносит фотографию.
     *
     * Теперь причина называет себя сама.
     */
    it('истёкший срок называется сроком, а не молчанием', async () => {
        const fetcher = vi.fn((_url: string, init?: RequestInit) => new Promise<Response>((_, reject) => {
            // Настоящий fetch на прерывание отвечает именно так.
            init?.signal?.addEventListener('abort', () => {
                const e = new Error('aborted');
                e.name = 'AbortError';
                reject(e);
            });
        }));
        const attempt = await tryTelegramAvatar('12345', TELEGRAM, fetcher as never);
        expect(attempt.miss).toBe('tg_photos_unreachable');
        expect(attempt.detail).toContain('истёк срок');
        // Тест ждёт настоящий срок, а он теперь длиннее предела vitest по
        // умолчанию. Подделывать время здесь нечестно: проверяется как раз
        // то, что срок действительно срабатывает.
    }, MESSENGER_TIMEOUT_MS + 4000);

    it('срок ожидания — восемь секунд, а не четыре', () => {
        // Кружок ленивый, удача живёт в кэше шесть часов: ждать приходится
        // один раз. Аватарка, которая не появляется НИКОГДА, хуже той, что
        // появилась через шесть секунд.
        expect(MESSENGER_TIMEOUT_MS).toBe(8000);
    });

    it('getChat не ответил — это своя причина, а не «фотографий нет»', async () => {
        const fetcher = vi.fn(async (url: string) => {
            if (url.includes('getUserProfilePhotos')) return json({ result: { total_count: 0, photos: [] } });
            if (url.includes('getChat')) return { ok: false, status: 502, json: async () => ({}) };
            return png();
        });
        const attempt = await tryTelegramAvatar('12345', TELEGRAM, fetcher as never);
        expect(attempt.miss).toBe('tg_chat_unreachable');
        expect(attempt.detail).toContain('502');
    });

    it('к причине приложены числа, которые мессенджер реально вернул', async () => {
        const fetcher = vi.fn(async (url: string) => {
            if (url.includes('getUserProfilePhotos')) return json({ result: { total_count: 0, photos: [] } });
            if (url.includes('getChat')) return json({ result: { id: 12345 } });
            return png();
        });
        const attempt = await tryTelegramAvatar('12345', TELEGRAM, fetcher as never);
        expect(attempt.miss).toBe('tg_no_photos');
        expect(attempt.detail).toContain('photos=0');
        expect(attempt.detail).toContain('chat=фото нет');
    });

    it('в подробностях нет ни ключа бота, ни идентификатора человека', async () => {
        const fetcher = vi.fn(async () => ({ ok: false, status: 400, json: async () => ({}) }));
        const attempt = await tryTelegramAvatar('987654321', TELEGRAM, fetcher as never);
        // Журнал читают люди, которым карточки этого клиента не показывают.
        expect(attempt.detail ?? '').not.toContain('987654321');
        expect(attempt.detail ?? '').not.toContain(TELEGRAM.token);
    });

    it('пусто у обеих дорог — тогда фотографии правда нет', async () => {
        const fetcher = vi.fn(async (url: string) => {
            if (url.includes('getUserProfilePhotos')) return json({ result: { total_count: 0, photos: [] } });
            if (url.includes('getChat')) return json({ result: { id: 12345 } });
            return png();
        });
        const attempt = await tryTelegramAvatar('12345', TELEGRAM, fetcher as never);
        expect(attempt.image).toBeNull();
        expect(attempt.miss).toBe('tg_no_photos');
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
