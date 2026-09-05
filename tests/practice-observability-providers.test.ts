// Задача 25 §10, §11, §12: отказ внешней системы должен быть виден нам и
// невидим для того, чьи данные она везёт.
//
// Обычный `console.error('sync failed', e)` кажется безобидным ровно до того
// момента, когда вспоминаешь, что в `e` лежит ответ провайдера, а в ответе —
// событие календаря с заголовком «Сессия — Анна Волкова». Логи живут дольше
// базы и читаются шире: попавшее туда имя человека убрать уже нельзя.
//
// Здесь проверяется, что безопасность лога — свойство функции, а не
// дисциплина автора: любое человеческое значение отсекается самой logSafeFailure.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const world = vi.hoisted(() => ({
    logs: [] as string[],
    tracked: [] as unknown[],
    outcome: { reason: 'no_token' } as { reason: string; suggestions?: unknown[] },
    integrations: [] as Array<{ id: string; provider: string; accessToken: string | null; caldavLogin: string | null }>,
    googleError: null as Error | null,
    yandexError: null as Error | null,
}));

vi.mock('@/lib/analytics/track', () => ({
    track: vi.fn(async (_db: unknown, input: unknown) => { world.tracked.push(input); }),
}));

vi.mock('@/auth', () => ({ auth: vi.fn(async () => ({ user: { id: 'psy-1' } })) }));

vi.mock('@/lib/dadata/suggest', () => ({
    suggestAddresses: vi.fn(async () => world.outcome),
}));

vi.mock('@/lib/db', () => ({
    db: {
        psychologistSettings: { findUnique: vi.fn(async () => ({ autoSync: true })) },
        calendarIntegration: { findMany: vi.fn(async () => world.integrations) },
        calendarSessionLink: {
            findFirst: vi.fn(async () => null),
            findMany: vi.fn(async () => []),
            create: vi.fn(async () => ({})),
            deleteMany: vi.fn(async () => ({ count: 0 })),
        },
    },
}));

vi.mock('@/lib/calendar/google', () => ({
    createGoogleCalendarEvent: vi.fn(async () => { if (world.googleError) throw world.googleError; return { success: true, eventId: 'ev-1' }; }),
    updateGoogleCalendarEvent: vi.fn(async () => ({ success: true })),
    deleteGoogleCalendarEvent: vi.fn(async () => ({ success: true })),
    deleteGoogleCalendarEventById: vi.fn(async () => ({ success: true })),
}));

vi.mock('@/lib/calendar/yandex', () => ({
    pushSessionToYandex: vi.fn(async () => { if (world.yandexError) throw world.yandexError; return { success: true, eventId: 'ev-2' }; }),
    updateYandexCalendarEvent: vi.fn(async () => ({ success: true })),
    deleteYandexCalendarEventById: vi.fn(async () => ({ success: true })),
}));

const { logSafeFailure, providerErrorCode } = await import('@/lib/observability/log');
const dadata = await import('@/app/api/dadata/route');
const autoSync = await import('@/lib/calendar/auto-sync');

const SESSION = {
    id: 'sess-1', date: new Date('2026-09-10T00:00:00.000Z'), time: '10:00', endTime: '10:50',
    duration: 50, type: 'individual', format: 'online', notes: 'тревога, сон',
    client: { name: 'Анна Волкова' },
};

beforeEach(() => {
    world.logs = [];
    world.tracked = [];
    world.outcome = { reason: 'no_token' };
    world.integrations = [{ id: 'int-1', provider: 'google', accessToken: 'tok', caldavLogin: null }];
    world.googleError = null;
    world.yandexError = null;
    vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => { world.logs.push(args.join(' ')); });
});

describe('безопасный лог как свойство функции', () => {
    it('пишет поля, а не рассказ', () => {
        logSafeFailure('calendar-sync', { provider: 'google', error_code: 'PROVIDER_TIMEOUT', correlation_id: 'abc-1' });

        expect(world.logs[0]).toBe('[calendar-sync] provider=google error_code=PROVIDER_TIMEOUT correlation_id=abc-1');
    });

    it('человеческий текст в поле не проходит — вместо него метка', () => {
        logSafeFailure('calendar-sync', { provider: 'Сессия — Анна Волкова', error_code: 'X' });

        expect(world.logs[0]).toContain('provider=unsafe_value');
        expect(world.logs[0]).not.toContain('Волкова');
    });

    it('перевод строки и пробелы тоже не проходят: строку лога не подделать', () => {
        logSafeFailure('x', { error_code: 'OK\nphone=+79991234567' });

        expect(world.logs[0]).not.toContain('+7999');
        expect(world.logs[0]).toContain('error_code=unsafe_value');
    });

    it('лог не может уронить то, за чем наблюдает', () => {
        vi.mocked(console.error).mockImplementationOnce(() => { throw new Error('поток закрыт'); });

        expect(() => logSafeFailure('x', { error_code: 'Y' })).not.toThrow();
    });

    it('категория отказа берётся из вида исключения, а не из его текста', () => {
        const timeout = Object.assign(new Error('Анна Волкова'), { name: 'AbortError' });
        const network = Object.assign(new Error('+79991234567'), { name: 'TypeError' });

        expect(providerErrorCode(timeout)).toBe('PROVIDER_TIMEOUT');
        expect(providerErrorCode(network)).toBe('PROVIDER_UNREACHABLE');
        expect(providerErrorCode(new Error('что угодно'))).toBe('PROVIDER_ERROR');
    });
});

describe('подсказки адресов', () => {
    it('ненастроенный ключ виден в логе категорией', async () => {
        await dadata.POST({ json: async () => ({ query: 'Москва, Тверская 1' }) } as never);

        expect(world.logs.join('\n')).toContain('[dadata] provider=dadata error_code=NO_TOKEN');
    });

    it('таймаут и ошибка провайдера различимы', async () => {
        world.outcome = { reason: 'timeout' };
        await dadata.POST({ json: async () => ({ query: 'x' }) } as never);
        world.outcome = { reason: 'upstream_error' };
        await dadata.POST({ json: async () => ({ query: 'x' }) } as never);

        expect(world.logs.join('\n')).toContain('error_code=TIMEOUT');
        expect(world.logs.join('\n')).toContain('error_code=UPSTREAM_ERROR');
    });

    it('сам запрос в лог не попадает — а это адрес, который набрал человек', async () => {
        await dadata.POST({ json: async () => ({ query: 'Москва, Тверская 1, кв. 5' }) } as never);

        expect(world.logs.join('\n')).not.toContain('Тверская');
    });

    it('негодный запрос и частые запросы — не поломка интеграции, в логе их нет', async () => {
        world.outcome = { reason: 'invalid_query' };
        await dadata.POST({ json: async () => ({ query: '' }) } as never);
        world.outcome = { reason: 'rate_limited' };
        await dadata.POST({ json: async () => ({ query: 'x' }) } as never);

        expect(world.logs).toEqual([]);
    });

    it('своего события в аналитике у DaData нет и не должно быть', async () => {
        await dadata.POST({ json: async () => ({ query: 'x' }) } as never);

        expect(world.tracked).toEqual([]);
    });
});

describe('синхронизация календарей', () => {
    it('отказ провайдера назван провайдером и категорией, без содержимого встречи', async () => {
        world.googleError = new Error('403 {"summary":"Сессия — Анна Волкова","description":"тревога","token":"ya29.secret"}');

        await autoSync.autoSyncSessionToCalendars('psy-1', SESSION);

        const line = world.logs.join('\n');
        expect(line).toContain('[calendar-sync] provider=google');
        expect(line).toContain('error_code=PROVIDER_ERROR');
        expect(line).toMatch(/correlation_id=[0-9a-f-]{36}/);
        for (const secret of ['Волкова', 'тревога', 'ya29', 'summary', 'sess-1']) {
            expect(line).not.toContain(secret);
        }
    });

    it('одна операция — один correlation_id на оба календаря', async () => {
        world.integrations = [
            { id: 'int-1', provider: 'google', accessToken: 'tok', caldavLogin: null },
            { id: 'int-2', provider: 'yandex', accessToken: null, caldavLogin: 'login' },
        ];
        world.googleError = new Error('google down');
        world.yandexError = new Error('yandex down');

        await autoSync.autoSyncSessionToCalendars('psy-1', SESSION);

        const ids = world.logs.map((l) => /correlation_id=([0-9a-f-]{36})/.exec(l)?.[1]);
        expect(ids).toHaveLength(2);
        expect(new Set(ids).size).toBe(1);
        expect(world.logs.join('\n')).toContain('provider=yandex');
    });

    it('наблюдаемость не превращает необязательную синхронизацию в обязательную', async () => {
        world.googleError = new Error('всё сломалось');

        await expect(autoSync.autoSyncSessionToCalendars('psy-1', SESSION)).resolves.toBeUndefined();
    });

    it('удаление из календаря логируется своей операцией', async () => {
        const { db } = await import('@/lib/db');
        vi.mocked(db.calendarSessionLink.findMany).mockResolvedValueOnce([
            { integrationId: 'int-1', externalEventId: 'ev-1', integration: { provider: 'google', accessToken: 'tok', caldavLogin: null } },
        ] as never);
        const google = await import('@/lib/calendar/google');
        vi.mocked(google.deleteGoogleCalendarEventById).mockRejectedValueOnce(new Error('gone: Анна Волкова'));

        await autoSync.autoDeleteSessionFromCalendars('psy-1', 'sess-1');

        const line = world.logs.join('\n');
        expect(line).toContain('source=session_delete');
        expect(line).not.toContain('Волкова');
    });

    it('своего события в аналитике у синхронизации нет и не должно быть', async () => {
        world.googleError = new Error('down');

        await autoSync.autoSyncSessionToCalendars('psy-1', SESSION);

        expect(world.tracked).toEqual([]);
    });
});
