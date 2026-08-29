// ПРАКТИКА · CJM записи, ТЗ 29.08.2026 §4.3, экран 7 «Мои встречи»:
// /api/user/diary/bot/client/sessions отдавал только предстоящие сессии
// (date >= сегодня), прошедших не было вовсе — вкладку «Прошедшие» было
// нечем наполнять. Эти тесты проверяют, что маршрут теперь возвращает обе
// корзины отдельно и с правильными границами/сортировкой.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const db = vi.hoisted(() => ({
    diaryClient: { findFirst: vi.fn() },
    telegramClient: { findUnique: vi.fn() },
    diarySession: { findMany: vi.fn() },
}));
vi.mock('@/lib/db', () => ({ db }));

vi.mock('@/lib/client-workflow', () => ({
    clientActionToken: (psychologistId: string, clientId: string) => `token:${psychologistId}:${clientId}`,
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

async function req(qs: string) {
    const { NextRequest } = await import('next/server');
    return new NextRequest(`https://cmpas.ru/api/user/diary/bot/client/sessions${qs}`);
}

describe('GET /api/user/diary/bot/client/sessions — предстоящие и прошедшие отдельно (§4.3)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('без clientId и telegramChatId — обе корзины пустые, без обращения к БД сессий', async () => {
        const { GET } = await import('../src/app/api/user/diary/bot/client/sessions/route');
        const res = await GET(await req(''));
        expect(await res.json()).toEqual({ upcoming: [], past: [] });
        expect(db.diarySession.findMany).not.toHaveBeenCalled();
    });

    it('возвращает upcoming (date >= сегодня, по возрастанию) и past (date < сегодня, по убыванию) отдельными списками', async () => {
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
        const res = await GET(await req('?clientId=client-1'));
        const body = await res.json();

        expect(body.upcoming).toHaveLength(1);
        expect(body.upcoming[0].id).toBe('u1');
        expect(body.past).toHaveLength(1);
        expect(body.past[0].id).toBe('p1');

        // Форма отображаемого объекта сохранена для обеих корзин (тот же mapSession).
        expect(body.past[0]).toMatchObject({
            clientId: 'client-1',
            clientToken: 'token:psy-1:client-1',
            psychologistName: 'Анна Волкова',
        });
    });

    it('resolveClientId работает по telegramChatId так же, как раньше (через DiaryClient и TelegramClient)', async () => {
        db.diaryClient.findFirst.mockResolvedValue(null);
        db.telegramClient.findUnique.mockResolvedValue({ diaryClientId: 'linked-client' });
        db.diarySession.findMany.mockResolvedValue([]);

        const { GET } = await import('../src/app/api/user/diary/bot/client/sessions/route');
        await GET(await req('?telegramChatId=tg-42'));

        expect(db.diarySession.findMany).toHaveBeenCalledWith(expect.objectContaining({
            where: expect.objectContaining({ clientId: 'linked-client' }),
        }));
    });
});
