// Идемпотентность создания записей из приложения (Часть 2, правило «б»).
//
// Очередь досылки рождает ключ в момент постановки записи, а не в момент
// отправки. Смысл ровно один: если ответ сервера потерян (сеть отвалилась
// после того, как запрос уже обработан), повтор придёт с тем же ключом — и
// обязан вернуть уже созданное, а не создать вторую сессию в расписании
// специалиста. Иначе починка потери данных оплачивалась бы дублями.
//
// Проверяется НАСТОЯЩИЙ обработчик маршрута из этого репозитория, а не его
// пересказ: подменена только база и проверка токена.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const store = {
    sessions: [] as any[],
    clients: [] as any[],
};

vi.mock('@/lib/mobile-auth', () => ({
    authenticateMobileRequest: async () => ({ userId: 'psy-1' }),
    unauthorizedResponse: () => new Response('unauthorized', { status: 401 }),
}));

vi.mock('@/lib/db', () => ({
    db: {
        diarySession: {
            findFirst: async ({ where }: any) => {
                if (where.clientRequestId) {
                    return store.sessions.find(
                        (s) => s.clientRequestId === where.clientRequestId && s.psychologistId === where.psychologistId,
                    ) ?? null;
                }
                return null;
            },
            findMany: async () => [],
            create: async ({ data }: any) => {
                const row = { id: `session-${store.sessions.length + 1}`, ...data, client: { id: data.clientId, name: 'Клиент' } };
                store.sessions.push(row);
                return row;
            },
            count: async () => store.sessions.length,
        },
        diaryClient: {
            findFirst: async ({ where }: any) => {
                if (where.clientRequestId) {
                    return store.clients.find(
                        (c) => c.clientRequestId === where.clientRequestId && c.psychologistId === where.psychologistId,
                    ) ?? null;
                }
                return null;
            },
            create: async ({ data }: any) => {
                const row = { id: `client-${store.clients.length + 1}`, ...data };
                store.clients.push(row);
                return row;
            },
            update: async ({ data }: any) => ({ ...data }),
        },
        user: { findUnique: async () => ({ id: 'psy-1', psychologistSettings: null }) },
    },
}));

vi.mock('@/lib/calendar/auto-sync', () => ({
    autoSyncSessionToCalendars: async () => undefined,
    autoDeleteSessionFromCalendars: async () => undefined,
}));
vi.mock('@/lib/notifications', () => ({ createNotification: async () => undefined }));
// Соседние модули маршрута подменены целиком: предмет проверки — ветка
// идемпотентности самого маршрута, а не рассылка, календари и документы.
// Заодно это обрезает цепочку импортов, которая тянет next-auth: он не
// поднимается в vitest (его ESM не находит next/server).
vi.mock('@/lib/telegram', () => ({ sendTelegramMessage: async () => true }));
vi.mock('@/lib/max-bot', () => ({ sendMaxMessage: async () => ({ success: true }) }));
vi.mock('@/lib/session-maintenance', () => ({ settlePastSessionsForPsychologist: async () => undefined }));
vi.mock('@/lib/client-workflow', () => ({
    buildSessionClientMessage: () => '',
    clientBookingLink: () => '',
    createAutoDocumentDeliveries: async () => [],
    getPaymentInstruction: () => '',
}));

function post(url: string, body: unknown) {
    return new Request(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: 'Bearer token' },
        body: JSON.stringify(body),
    });
}

describe('POST /api/mobile/sessions — повтор с тем же ключом не создаёт вторую сессию', () => {
    beforeEach(() => {
        store.sessions = [];
        store.clients = [];
        vi.resetModules();
    });

    it('два одинаковых запроса с одним clientRequestId дают одну сессию', async () => {
        const { POST } = await import('../src/app/api/mobile/sessions/route');
        const body = {
            clientId: 'client-1',
            date: '2026-09-01',
            startTime: '10:00',
            clientRequestId: 'op-42',
        };

        // Создание отвечает 201, повтор — 200: разница намеренная и полезная,
        // по ней клиент отличает «создано сейчас» от «уже было создано».
        const first = await POST(post('https://cmpas.ru/api/mobile/sessions', body) as any);
        expect(first.status).toBe(201);
        const second = await POST(post('https://cmpas.ru/api/mobile/sessions', body) as any);
        expect(second.status).toBe(200);

        expect(store.sessions).toHaveLength(1);
        expect((await first.json()).id).toBe((await second.json()).id);
    });

    it('без ключа поведение прежнее — веб и старые сборки не ломаются', async () => {
        const { POST } = await import('../src/app/api/mobile/sessions/route');
        const body = { clientId: 'client-1', date: '2026-09-01', startTime: '10:00' };
        await POST(post('https://cmpas.ru/api/mobile/sessions', body) as any);
        expect(store.sessions).toHaveLength(1);
        expect(store.sessions[0].clientRequestId).toBeNull();
    });

    it('гонка двух повторов: отказ БД по UNIQUE возвращает уже созданное, а не 500', async () => {
        // Два одновременных повтора оба проходят проверку по ключу и второй
        // упирается в UNIQUE-индекс. Проверено на настоящем Postgres, что БД
        // такой дубль отвергает; здесь проверяется, что маршрут это переживает.
        const { POST } = await import('../src/app/api/mobile/sessions/route');
        const { db } = (await import('@/lib/db')) as any;

        // Строка уже создана «другим процессом» ПОСЛЕ того, как наша проверка
        // по ключу вернула пусто: create падает, findFirst её находит.
        const realCreate = db.diarySession.create;
        db.diarySession.create = async () => {
            store.sessions.push({ id: 'session-raced', clientRequestId: 'op-race', psychologistId: 'psy-1', client: { id: 'c', name: 'Клиент' }, date: new Date(), time: '10:00' });
            const err: any = new Error('Unique constraint failed');
            err.code = 'P2002';
            Object.setPrototypeOf(err, (await import('@prisma/client')).Prisma.PrismaClientKnownRequestError.prototype);
            throw err;
        };

        const res = await POST(post('https://cmpas.ru/api/mobile/sessions', {
            clientId: 'c', date: '2026-09-01', startTime: '10:00', clientRequestId: 'op-race',
        }) as any);

        db.diarySession.create = realCreate;
        expect(res.status).not.toBe(500);
        expect(store.sessions).toHaveLength(1);
        expect((await res.json()).id).toBe('session-raced');
    });

    it('разные ключи создают разные сессии', async () => {
        const { POST } = await import('../src/app/api/mobile/sessions/route');
        await POST(post('https://cmpas.ru/api/mobile/sessions', { clientId: 'c', date: '2026-09-01', startTime: '10:00', clientRequestId: 'op-1' }) as any);
        await POST(post('https://cmpas.ru/api/mobile/sessions', { clientId: 'c', date: '2026-09-08', startTime: '10:00', clientRequestId: 'op-2' }) as any);
        expect(store.sessions).toHaveLength(2);
    });
});

describe('POST /api/mobile/clients — повтор с тем же ключом не создаёт вторую карточку', () => {
    beforeEach(() => {
        store.sessions = [];
        store.clients = [];
        vi.resetModules();
    });

    it('клиент без телефона не задваивается при повторе', async () => {
        // Именно без телефона: поиск по телефону, который был здесь раньше,
        // такому клиенту не помогает — совпадать нечему.
        const { POST } = await import('../src/app/api/mobile/clients/route');
        const body = { name: 'Без телефона', clientRequestId: 'op-client-7' };

        const first = await POST(post('https://cmpas.ru/api/mobile/clients', body) as any);
        const second = await POST(post('https://cmpas.ru/api/mobile/clients', body) as any);

        expect(store.clients).toHaveLength(1);
        expect((await first.json()).id).toBe((await second.json()).id);
    });
});
