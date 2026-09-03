// ПРАКТИКА · CJM записи, ТЗ 29.08.2026 §4.3, экран 7 «Мои встречи».
//
// Task 3 (PRAKTIKA MVP addendum §6, REGRESSION GATE — CRITICAL): этот
// маршрут отдавал сессии ЛЮБОГО клиента по сырому ?clientId=<raw> или
// ?telegramChatId=<raw> без какой-либо проверки — confirmed live IDOR
// (клиент A мог прочитать даты/время/адрес/специалиста клиента B, зная
// только его clientId, который сам же маршрут возвращает в каждом ответе).
// Единственные легитимные источники личности теперь: HMAC-проверенный
// Telegram initData (заголовок X-Telegram-Init-Data) и подписанный
// personal-link токен (?c=), заново проверяемый на каждый запрос.
//
// Заодно сохраняется поведение из ТЗ 29.08.2026 §4.3: upcoming/past —
// отдельные корзины с правильными границами/сортировкой.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const db = vi.hoisted(() => ({
    diaryClient: { findFirst: vi.fn() },
    telegramClient: { findUnique: vi.fn() },
    diarySession: { findMany: vi.fn() },
}));
vi.mock('@/lib/db', () => ({ db }));

const resolvePersonalClientToken = vi.hoisted(() => vi.fn());
vi.mock('@/lib/client-workflow', () => ({
    clientActionToken: (psychologistId: string, clientId: string) => `token:${psychologistId}:${clientId}`,
    resolvePersonalClientToken: (...args: unknown[]) => resolvePersonalClientToken(...args),
}));

const verifyTelegramWebAppInitData = vi.hoisted(() => vi.fn());
vi.mock('@/lib/telegram-webapp', () => ({
    verifyTelegramWebAppInitData: (...args: unknown[]) => verifyTelegramWebAppInitData(...args),
}));

function makeSession(overrides: Record<string, unknown>) {
    return {
        id: 's1',
        clientId: 'client-1',
        psychologistId: 'psy-1',
        date: new Date('2026-08-29T00:00:00.000Z'),
        time: '10:00',
        endTime: '10:50',
        status: 'confirmed',
        format: 'online',
        psychologist: { name: 'Анна Волкова', psychologistSettings: { fullName: 'Анна Волкова', onlineSessionLink: null } },
        address: null,
        ...overrides,
    };
}

async function req(qs: string, headers: Record<string, string> = {}) {
    const { NextRequest } = await import('next/server');
    return new NextRequest(`https://cmpas.ru/api/user/diary/bot/client/sessions${qs}`, { headers });
}

describe('GET /api/user/diary/bot/client/sessions — подлинность источника (Task 3, addendum §6)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('сырой ?clientId=<raw> без подписи ИГНОРИРУЕТСЯ — пустые корзины, БД сессий не трогается', async () => {
        // Маршрут не читает ?clientId= вовсе (нет такого параметра в новом
        // контракте) — resolvePersonalClientToken вызывается с `c` (тут
        // отсутствующим), возвращает null по умолчанию мока.
        const { GET } = await import('../src/app/api/user/diary/bot/client/sessions/route');
        const res = await GET(await req('?clientId=client-of-b'));
        expect(await res.json()).toEqual({ upcoming: [], past: [] });
        expect(db.diarySession.findMany).not.toHaveBeenCalled();
        expect(resolvePersonalClientToken).toHaveBeenCalledWith(null);
    });

    it('сырой ?telegramChatId=<raw> без заголовка initData ИГНОРИРУЕТСЯ — пустые корзины', async () => {
        const { GET } = await import('../src/app/api/user/diary/bot/client/sessions/route');
        const res = await GET(await req('?telegramChatId=tg-of-b'));
        expect(await res.json()).toEqual({ upcoming: [], past: [] });
        expect(db.diaryClient.findFirst).not.toHaveBeenCalled();
        expect(db.diarySession.findMany).not.toHaveBeenCalled();
    });

    it('без каких-либо параметров — обе корзины пустые, без обращения к БД сессий', async () => {
        resolvePersonalClientToken.mockReturnValue(null);
        const { GET } = await import('../src/app/api/user/diary/bot/client/sessions/route');
        const res = await GET(await req(''));
        expect(await res.json()).toEqual({ upcoming: [], past: [] });
        expect(db.diarySession.findMany).not.toHaveBeenCalled();
    });

    it('невалидный/чужой ?c= токен — resolvePersonalClientToken возвращает null, пустые корзины', async () => {
        resolvePersonalClientToken.mockReturnValue(null);
        const { GET } = await import('../src/app/api/user/diary/bot/client/sessions/route');
        const res = await GET(await req('?c=st1_tamperedortoosomeoneelse'));
        expect(resolvePersonalClientToken).toHaveBeenCalledWith('st1_tamperedortoosomeoneelse');
        expect(await res.json()).toEqual({ upcoming: [], past: [] });
        expect(db.diarySession.findMany).not.toHaveBeenCalled();
    });

    it('валидный ?c= токен — сервер сам резолвит clientId из токена, отдаёт upcoming и past отдельно', async () => {
        resolvePersonalClientToken.mockReturnValue({ clientId: 'client-1', legacy: false });
        const upcomingRow = makeSession({ id: 'u1', date: new Date('2026-09-01T00:00:00.000Z') });
        const pastRow = makeSession({ id: 'p1', date: new Date('2026-08-01T00:00:00.000Z'), time: '09:00' });

        db.diarySession.findMany.mockImplementation(({ where, orderBy }: any) => {
            const isUpcomingQuery = 'gte' in (where.date ?? {});
            expect(where.clientId).toBe('client-1');
            expect(where.status).toEqual({ not: 'cancelled' });
            if (isUpcomingQuery) {
                expect(orderBy).toEqual([{ date: 'asc' }, { time: 'asc' }]);
                return Promise.resolve([upcomingRow]);
            }
            expect('lt' in where.date).toBe(true);
            expect(orderBy).toEqual([{ date: 'desc' }, { time: 'desc' }]);
            return Promise.resolve([pastRow]);
        });

        const { GET } = await import('../src/app/api/user/diary/bot/client/sessions/route');
        const res = await GET(await req('?c=st1_validtoken'));
        const body = await res.json();

        expect(body.upcoming).toHaveLength(1);
        expect(body.upcoming[0].id).toBe('u1');
        expect(body.past).toHaveLength(1);
        expect(body.past[0].id).toBe('p1');
        expect(body.past[0]).toMatchObject({
            clientId: 'client-1',
            clientToken: 'token:psy-1:client-1',
            psychologistName: 'Анна Волкова',
        });
    });

    it('заголовок X-Telegram-Init-Data не проходит HMAC-проверку — пустые корзины, БД клиента не трогается', async () => {
        verifyTelegramWebAppInitData.mockReturnValue(null);
        const { GET } = await import('../src/app/api/user/diary/bot/client/sessions/route');
        const res = await GET(await req('', { 'x-telegram-init-data': 'forged-or-tampered' }));
        expect(await res.json()).toEqual({ upcoming: [], past: [] });
        expect(db.diaryClient.findFirst).not.toHaveBeenCalled();
        expect(db.diarySession.findMany).not.toHaveBeenCalled();
    });

    it('валидный X-Telegram-Init-Data резолвит клиента через DiaryClient/TelegramClient — как раньше, но только после верификации', async () => {
        verifyTelegramWebAppInitData.mockReturnValue({ id: 424242, first_name: 'Клиент' });
        db.diaryClient.findFirst.mockResolvedValue(null);
        db.telegramClient.findUnique.mockResolvedValue({ diaryClientId: 'linked-client' });
        db.diarySession.findMany.mockResolvedValue([]);

        const { GET } = await import('../src/app/api/user/diary/bot/client/sessions/route');
        await GET(await req('', { 'x-telegram-init-data': 'valid-signed-init-data' }));

        expect(verifyTelegramWebAppInitData).toHaveBeenCalledWith('valid-signed-init-data', process.env.TELEGRAM_BOT_TOKEN);
        expect(db.diaryClient.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { telegramChatId: '424242' } }));
        expect(db.telegramClient.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { telegramUserId: '424242' } }));
        expect(db.diarySession.findMany).toHaveBeenCalledWith(expect.objectContaining({
            where: expect.objectContaining({ clientId: 'linked-client' }),
        }));
    });
});
