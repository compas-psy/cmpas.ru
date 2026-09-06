// Задача 20: приложение перестало выдумывать данные — значит сервер обязан
// эти данные отдавать.
//
// Два места, без которых экран профиля снова начал бы врать:
//   /api/mobile/me                    — реальное состояние мессенджеров
//   /api/mobile/notification-settings — настоящие настройки напоминаний
//
// Второй ресурс отдаёт РОВНО два поля: напоминание клиенту за сутки и за час.
// Именно за ними стоит настоящая рассылка; «за 2 часа», «об оплате» и «о
// документах» в приложении были тумблерами без всякой серверной стороны.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const world = vi.hoisted(() => ({
    user: null as Record<string, unknown> | null,
    settings: null as Record<string, boolean> | null,
    created: [] as unknown[],
    updated: [] as unknown[],
    authUserId: 'psy-1' as string | null,
}));

vi.mock('@/lib/mobile-auth', () => ({
    authenticateMobileRequest: vi.fn(async () => (world.authUserId ? { userId: world.authUserId } : null)),
    unauthorizedResponse: () => new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
}));

vi.mock('@/lib/db', () => ({
    db: {
        user: { findUnique: vi.fn(async () => world.user) },
        notificationSettings: {
            findUnique: vi.fn(async () => world.settings),
            create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
                world.created.push(data);
                world.settings = { clientReminder25hEnabled: true, clientReminder1hEnabled: true, ...(data as Record<string, boolean>) };
                return { clientReminder25hEnabled: world.settings.clientReminder25hEnabled, clientReminder1hEnabled: world.settings.clientReminder1hEnabled };
            }),
            upsert: vi.fn(async ({ update }: { update: Record<string, boolean> }) => {
                world.updated.push(update);
                world.settings = { clientReminder25hEnabled: true, clientReminder1hEnabled: true, ...(world.settings ?? {}), ...update };
                return { clientReminder25hEnabled: world.settings.clientReminder25hEnabled, clientReminder1hEnabled: world.settings.clientReminder1hEnabled };
            }),
        },
    },
}));

const me = await import('@/app/api/mobile/me/route');
const reminders = await import('@/app/api/mobile/notification-settings/route');

function request(body?: unknown) {
    return { json: async () => body } as never;
}

beforeEach(() => {
    world.user = {
        id: 'psy-1', name: 'Илья', email: 'psy@example.com', image: null, role: 'PSYCHOLOGIST',
        analyticsConsentAt: null, telegramChatId: null, maxChatId: null,
    };
    world.settings = null;
    world.created = [];
    world.updated = [];
    world.authUserId = 'psy-1';
});

describe('GET /api/mobile/me — состояние мессенджеров настоящее', () => {
    it('оба не подключены — так и сказано', async () => {
        const body = await (await me.GET(request())).json();

        expect(body.telegramConnected).toBe(false);
        expect(body.maxConnected).toBe(false);
    });

    it('подключённый Telegram виден как подключённый', async () => {
        world.user = { ...world.user, telegramChatId: '12345' };

        const body = await (await me.GET(request())).json();

        expect(body.telegramConnected).toBe(true);
        expect(body.maxConnected).toBe(false);
    });

    it('идентификатор чата наружу не отдаётся — приложению нужен факт, а не адрес', async () => {
        world.user = { ...world.user, telegramChatId: '12345', maxChatId: '67890' };

        const body = await (await me.GET(request())).json();

        expect(body.telegramChatId).toBeUndefined();
        expect(body.maxChatId).toBeUndefined();
        expect(body.telegramConnected).toBe(true);
        expect(body.maxConnected).toBe(true);
    });
});

describe('GET /api/mobile/notification-settings', () => {
    it('без авторизации не отвечает', async () => {
        world.authUserId = null;

        expect((await reminders.GET(request())).status).toBe(401);
    });

    it('отдаёт ровно два поля — те, за которыми стоит настоящая рассылка', async () => {
        world.settings = { clientReminder25hEnabled: true, clientReminder1hEnabled: false };

        const body = await (await reminders.GET(request())).json();

        expect(Object.keys(body).sort()).toEqual(['clientReminder1hEnabled', 'clientReminder25hEnabled']);
        expect(body).toEqual({ clientReminder25hEnabled: true, clientReminder1hEnabled: false });
    });

    it('настроек ещё нет — заводятся со значениями по умолчанию, а не выдумываются на лету', async () => {
        const body = await (await reminders.GET(request())).json();

        expect(world.created).toHaveLength(1);
        expect(body).toEqual({ clientReminder25hEnabled: true, clientReminder1hEnabled: true });
    });
});

describe('PATCH /api/mobile/notification-settings', () => {
    it('без авторизации не пишет', async () => {
        world.authUserId = null;

        expect((await reminders.PATCH(request({ clientReminder1hEnabled: false }))).status).toBe(401);
        expect(world.updated).toEqual([]);
    });

    it('выключает напоминание за час, не трогая напоминание за сутки', async () => {
        const body = await (await reminders.PATCH(request({ clientReminder1hEnabled: false }))).json();

        expect(world.updated).toEqual([{ clientReminder1hEnabled: false }]);
        expect(body.clientReminder1hEnabled).toBe(false);
        expect(body.clientReminder25hEnabled).toBe(true);
    });

    it('чужие поля настроек через этот ресурс не проходят', async () => {
        await reminders.PATCH(request({
            clientReminder25hEnabled: false,
            morningDigestEnabled: false,
            clientReminder25hTemplate: 'подмена',
        }));

        expect(world.updated).toEqual([{ clientReminder25hEnabled: false }]);
    });

    it('не булево значение игнорируется, пустая правка отклоняется', async () => {
        const res = await reminders.PATCH(request({ clientReminder1hEnabled: 'да' }));

        expect(res.status).toBe(400);
        expect(await res.json()).toEqual({ error: 'NOTHING_TO_UPDATE' });
        expect(world.updated).toEqual([]);
    });

    it('битое тело не роняет запись настроек', async () => {
        const res = await reminders.PATCH({ json: async () => { throw new SyntaxError('bad'); } } as never);

        expect(res.status).toBe(400);
        expect(world.updated).toEqual([]);
    });
});
