// Задача 19: контракт прокси подсказок.
//
// Два свойства проверяются здесь. Первое: прокси перестал быть открытой
// дверью — подсказки платные, а поле адреса живёт только в кабинете
// специалиста, поэтому неавторизованный запрос не доходит до DaData вовсе.
// Второе: неудача НАЗЫВАЕТСЯ. Пустой список при 200 значит «ничего не
// нашли»; поломка провайдера, ненастроенный ключ и негодный запрос — это
// разные коды ответа. Раньше всё это выглядело одинаково пустым списком, и
// сломанная интеграция могла молчать месяцами.

import { describe, it, expect, vi, beforeEach } from 'vitest';

type Reason = 'ok' | 'cached' | 'invalid_query' | 'rate_limited' | 'no_token' | 'upstream_error' | 'timeout';

const session = vi.hoisted(() => ({ value: null as { user?: { id?: string } } | null }));
const core = vi.hoisted(() => ({
    calls: [] as Array<{ userId: string; query: unknown }>,
    outcome: { suggestions: [{ value: 'Москва, Яузская, 5', data: {} }], reason: 'ok' as Reason },
}));

vi.mock('@/auth', () => ({ auth: vi.fn(async () => session.value) }));
vi.mock('@/lib/dadata/suggest', () => ({
    suggestAddresses: vi.fn(async (params: { userId: string; query: unknown }) => {
        core.calls.push({ userId: params.userId, query: params.query });
        return core.outcome;
    }),
}));

const { POST } = await import('@/app/api/dadata/route');

function request(body: unknown, malformed = false) {
    return {
        json: async () => {
            if (malformed) throw new SyntaxError('Unexpected token');
            return body;
        },
    } as never;
}

beforeEach(() => {
    session.value = { user: { id: 'psy-1' } };
    core.calls = [];
    core.outcome = { suggestions: [{ value: 'Москва, Яузская, 5', data: {} }], reason: 'ok' };
});

describe('POST /api/dadata', () => {
    it('без сессии — 401 и ни одного обращения к DaData', async () => {
        session.value = null;

        const res = await POST(request({ query: 'Яузская' }));

        expect(res.status).toBe(401);
        expect(core.calls).toEqual([]);
    });

    it('сессия без идентификатора не проходит', async () => {
        session.value = { user: {} };

        const res = await POST(request({ query: 'Яузская' }));

        expect(res.status).toBe(401);
        expect(core.calls).toEqual([]);
    });

    it('авторизованный запрос доходит, и лимит считается на этого специалиста', async () => {
        const res = await POST(request({ query: 'Яузская' }));

        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({ suggestions: [{ value: 'Москва, Яузская, 5', data: {} }] });
        expect(core.calls).toEqual([{ userId: 'psy-1', query: 'Яузская' }]);
    });

    it('идентификатор специалиста берётся из сессии, а не из тела запроса', async () => {
        await POST(request({ query: 'Яузская', userId: 'psy-999' }));

        expect(core.calls[0].userId).toBe('psy-1');
    });

    it('битое тело — не 500, а честный отказ по запросу', async () => {
        core.outcome = { suggestions: [], reason: 'invalid_query' };

        const res = await POST(request(null, true));

        expect(res.status).toBe(400);
        expect(await res.json()).toEqual({ error: 'INVALID_QUERY' });
        expect(core.calls[0].query).toBeUndefined();
    });
});

describe('контракт ответа: неудача называется, а не прячется в пустом списке', () => {
    it('успех — 200 с подсказками', async () => {
        const res = await POST(request({ query: 'Яузская' }));

        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({ suggestions: [{ value: 'Москва, Яузская, 5', data: {} }] });
    });

    it('ответ из кэша — такой же 200, кэш наружу не виден', async () => {
        core.outcome = { suggestions: [{ value: 'Москва, Яузская, 5', data: {} }], reason: 'cached' };

        const res = await POST(request({ query: 'Яузская' }));

        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({ suggestions: [{ value: 'Москва, Яузская, 5', data: {} }] });
    });

    it('настоящий поиск с нулём результатов — 200 и пустой список, это НЕ поломка', async () => {
        core.outcome = { suggestions: [], reason: 'ok' };

        const res = await POST(request({ query: 'Такогоадресанет' }));

        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({ suggestions: [] });
    });

    it('негодный запрос — 400 INVALID_QUERY', async () => {
        core.outcome = { suggestions: [], reason: 'invalid_query' };

        const res = await POST(request({ query: 'Яу' }));

        expect(res.status).toBe(400);
        expect(await res.json()).toEqual({ error: 'INVALID_QUERY' });
    });

    it('ключ не настроен — 503 NOT_CONFIGURED', async () => {
        core.outcome = { suggestions: [], reason: 'no_token' };

        const res = await POST(request({ query: 'Яузская' }));

        expect(res.status).toBe(503);
        expect(await res.json()).toEqual({ error: 'NOT_CONFIGURED' });
    });

    it('DaData ответила ошибкой — 502 PROVIDER_UNAVAILABLE', async () => {
        core.outcome = { suggestions: [], reason: 'upstream_error' };

        const res = await POST(request({ query: 'Яузская' }));

        expect(res.status).toBe(502);
        expect(await res.json()).toEqual({ error: 'PROVIDER_UNAVAILABLE' });
    });

    it('DaData не уложилась в таймаут — 504 PROVIDER_UNAVAILABLE', async () => {
        core.outcome = { suggestions: [], reason: 'timeout' };

        const res = await POST(request({ query: 'Яузская' }));

        expect(res.status).toBe(504);
        expect(await res.json()).toEqual({ error: 'PROVIDER_UNAVAILABLE' });
    });

    it('исчерпан лимит — 429 RATE_LIMITED', async () => {
        core.outcome = { suggestions: [], reason: 'rate_limited' };

        const res = await POST(request({ query: 'Яузская' }));

        expect(res.status).toBe(429);
        expect(await res.json()).toEqual({ error: 'RATE_LIMITED' });
    });

    it('в теле неудачи нет ни подсказок, ни внутренней причины', async () => {
        core.outcome = { suggestions: [], reason: 'upstream_error' };

        const body = await (await POST(request({ query: 'Яузская' }))).json();

        expect(Object.keys(body)).toEqual(['error']);
    });
});
