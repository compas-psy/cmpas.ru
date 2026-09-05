// Задача 19: главное в укреплении — прокси перестал быть открытой дверью.
// Подсказки платные и считаются по запросам, а поле адреса живёт только в
// кабинете специалиста, поэтому неавторизованный запрос не должен доходить
// до DaData вовсе.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const session = vi.hoisted(() => ({ value: null as { user?: { id?: string } } | null }));
const core = vi.hoisted(() => ({ calls: [] as Array<{ userId: string; query: unknown }> }));

vi.mock('@/auth', () => ({ auth: vi.fn(async () => session.value) }));
vi.mock('@/lib/dadata/suggest', () => ({
    suggestAddresses: vi.fn(async (params: { userId: string; query: unknown }) => {
        core.calls.push({ userId: params.userId, query: params.query });
        return { suggestions: [{ value: 'Москва, Яузская, 5', data: {} }], reason: 'ok' };
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

    it('битое тело — не 500: поле адреса продолжает работать без подсказок', async () => {
        const res = await POST(request(null, true));

        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({ suggestions: [{ value: 'Москва, Яузская, 5', data: {} }] });
        expect(core.calls[0].query).toBeUndefined();
    });
});
