// Задача 19 — укрепление подсказок адресов DaData.
//
// Подсказки платные и считаются по запросам, а прокси был открыт: без
// авторизации, без ограничения частоты, без проверки запроса и без таймаута.
// Здесь проверяется, что ни один лишний платный запрос не уходит, что чужой
// запрос не превращается в 500, и что при любой неудаче поле адреса остаётся
// работоспособным — подсказки удобство, а не условие работы.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
    suggestAddresses,
    normalizeQuery,
    isRateLimited,
    MIN_QUERY_LENGTH,
    MAX_QUERY_LENGTH,
} from '@/lib/dadata/suggest';

const NOW = Date.UTC(2026, 8, 5, 12, 0, 0);
const TOKEN = 'dadata-token';

function dadataResponse(values: string[]) {
    return {
        ok: true,
        status: 200,
        json: async () => ({
            suggestions: values.map(value => ({
                value,
                data: { fias_id: 'fias-1', city: 'Москва', street: 'Яузская', house: '5', region: 'Москва', extra: 'лишнее' },
            })),
        }),
    } as unknown as Response;
}

function freshStores() {
    return { rateLimitStore: new Map<string, number[]>(), cache: new Map() };
}

let errorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
    errorSpy.mockRestore();
});

describe('проверка запроса до обращения к платному сервису', () => {
    it('короткий запрос не уходит в DaData', async () => {
        const fetchImpl = vi.fn();

        const res = await suggestAddresses({ userId: 'psy-1', query: 'Яу', token: TOKEN, now: NOW, fetchImpl: fetchImpl as unknown as typeof fetch, ...freshStores() });

        expect(res).toEqual({ suggestions: [], reason: 'invalid_query' });
        expect(fetchImpl).not.toHaveBeenCalled();
    });

    it('не строка — не запрос', async () => {
        const fetchImpl = vi.fn();
        const stores = freshStores();

        for (const query of [undefined, null, 42, { query: 'Яузская' }, ['Яузская']]) {
            const res = await suggestAddresses({ userId: 'psy-1', query, token: TOKEN, now: NOW, fetchImpl: fetchImpl as unknown as typeof fetch, ...stores });
            expect(res.reason).toBe('invalid_query');
        }
        expect(fetchImpl).not.toHaveBeenCalled();
    });

    it('негодный запрос не съедает лимит частоты — иначе мусором можно закрыть подсказки специалисту', async () => {
        const stores = freshStores();
        const fetchImpl = vi.fn(async () => dadataResponse(['Москва, Яузская, 5']));

        for (let i = 0; i < 200; i++) {
            await suggestAddresses({ userId: 'psy-1', query: 'ул', token: TOKEN, now: NOW, fetchImpl: fetchImpl as unknown as typeof fetch, ...stores });
        }
        const real = await suggestAddresses({ userId: 'psy-1', query: 'Яузская', token: TOKEN, now: NOW, fetchImpl: fetchImpl as unknown as typeof fetch, ...stores });

        expect(real.reason).toBe('ok');
    });

    it('слишком длинный запрос отклоняется целиком, а не обрезается', async () => {
        const stores = freshStores();
        const fetchImpl = vi.fn(async () => dadataResponse([]));
        const long = 'Яузская '.repeat(200);

        // Молча искать по обрезку — значит отвечать не на то, о чём спросили,
        // и выдавать это за результат.
        const res = await suggestAddresses({ userId: 'psy-1', query: long, token: TOKEN, now: NOW, fetchImpl: fetchImpl as unknown as typeof fetch, ...stores });

        expect(res.reason).toBe('invalid_query');
        expect(fetchImpl).not.toHaveBeenCalled();
    });

    it('запрос ровно предельной длины ещё проходит', async () => {
        const stores = freshStores();
        const fetchImpl = vi.fn(async () => dadataResponse([]));

        const res = await suggestAddresses({ userId: 'psy-1', query: 'я'.repeat(MAX_QUERY_LENGTH), token: TOKEN, now: NOW, fetchImpl: fetchImpl as unknown as typeof fetch, ...stores });

        expect(res.reason).toBe('ok');
    });

    it('normalizeQuery схлопывает пробелы и режет по краям', () => {
        expect(normalizeQuery('  Москва,   Яузская  ')).toBe('Москва, Яузская');
        expect(normalizeQuery('  ')).toBeNull();
        expect(normalizeQuery('я'.repeat(MIN_QUERY_LENGTH))).toHaveLength(MIN_QUERY_LENGTH);
        expect(normalizeQuery('я'.repeat(MAX_QUERY_LENGTH + 1))).toBeNull();
    });
});

describe('ограничение частоты — по специалисту, платит владелец ключа', () => {
    it('шквал запросов одного пользователя перестаёт доходить до DaData', async () => {
        const stores = freshStores();
        const fetchImpl = vi.fn(async () => dadataResponse(['Москва, Яузская, 5']));

        const reasons: string[] = [];
        for (let i = 0; i < 80; i++) {
            // Каждый запрос разный, иначе ответ придёт из кэша.
            const res = await suggestAddresses({ userId: 'psy-1', query: `Яузская ${i}`, token: TOKEN, now: NOW, fetchImpl: fetchImpl as unknown as typeof fetch, ...stores });
            reasons.push(res.reason);
        }

        expect(reasons).toContain('rate_limited');
        expect(fetchImpl.mock.calls.length).toBeLessThan(80);
    });

    it('лимит одного специалиста не закрывает подсказки другому', async () => {
        const stores = freshStores();
        const fetchImpl = vi.fn(async () => dadataResponse(['Москва, Яузская, 5']));

        for (let i = 0; i < 80; i++) {
            await suggestAddresses({ userId: 'psy-1', query: `Яузская ${i}`, token: TOKEN, now: NOW, fetchImpl: fetchImpl as unknown as typeof fetch, ...stores });
        }
        const other = await suggestAddresses({ userId: 'psy-2', query: 'Куркино', token: TOKEN, now: NOW, fetchImpl: fetchImpl as unknown as typeof fetch, ...stores });

        expect(other.reason).toBe('ok');
    });

    it('окно скользящее: через минуту счётчик снова пуст', () => {
        const store = new Map<string, number[]>();
        for (let i = 0; i < 61; i++) isRateLimited('psy-1', NOW, store);
        expect(isRateLimited('psy-1', NOW, store)).toBe(true);

        expect(isRateLimited('psy-1', NOW + 61_000, store)).toBe(false);
    });
});

describe('кэш экономит платные запросы', () => {
    it('повтор того же адреса не уходит в DaData второй раз', async () => {
        const stores = freshStores();
        const fetchImpl = vi.fn(async () => dadataResponse(['Москва, Яузская, 5']));

        const first = await suggestAddresses({ userId: 'psy-1', query: 'Яузская', token: TOKEN, now: NOW, fetchImpl: fetchImpl as unknown as typeof fetch, ...stores });
        const second = await suggestAddresses({ userId: 'psy-1', query: '  ЯУЗСКАЯ ', token: TOKEN, now: NOW + 1000, fetchImpl: fetchImpl as unknown as typeof fetch, ...stores });

        expect(first.reason).toBe('ok');
        expect(second.reason).toBe('cached');
        expect(second.suggestions).toEqual(first.suggestions);
        expect(fetchImpl).toHaveBeenCalledTimes(1);
    });

    it('через десять минут кэш протухает и запрос идёт заново', async () => {
        const stores = freshStores();
        const fetchImpl = vi.fn(async () => dadataResponse(['Москва, Яузская, 5']));

        await suggestAddresses({ userId: 'psy-1', query: 'Яузская', token: TOKEN, now: NOW, fetchImpl: fetchImpl as unknown as typeof fetch, ...stores });
        const later = await suggestAddresses({ userId: 'psy-1', query: 'Яузская', token: TOKEN, now: NOW + 11 * 60_000, fetchImpl: fetchImpl as unknown as typeof fetch, ...stores });

        expect(later.reason).toBe('ok');
        expect(fetchImpl).toHaveBeenCalledTimes(2);
    });
});

describe('деградация: поле адреса работает всегда', () => {
    it('без токена — пустой список, а не ошибка', async () => {
        const res = await suggestAddresses({ userId: 'psy-1', query: 'Яузская', token: null, now: NOW, fetchImpl: (() => { throw new Error('не должно вызываться'); }) as unknown as typeof fetch, ...freshStores() });

        expect(res).toEqual({ suggestions: [], reason: 'no_token' });
    });

    it('DaData ответила ошибкой — пустой список, в лог уходит только статус', async () => {
        const fetchImpl = vi.fn(async () => ({ ok: false, status: 429, json: async () => ({}) }) as unknown as Response);

        const res = await suggestAddresses({ userId: 'psy-1', query: 'Яузская, 5', token: TOKEN, now: NOW, fetchImpl: fetchImpl as unknown as typeof fetch, ...freshStores() });

        expect(res).toEqual({ suggestions: [], reason: 'upstream_error' });
        // Адрес кабинета специалиста в логи не попадает.
        const logged = errorSpy.mock.calls.flat().join(' ');
        expect(logged).not.toContain('Яузская');
        expect(logged).toContain('429');
    });

    it('DaData молчит дольше таймаута — запрос обрывается, список пуст', async () => {
        const fetchImpl = vi.fn((_url: string, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })));
        }));

        const res = await suggestAddresses({
            userId: 'psy-1', query: 'Яузская', token: TOKEN, now: NOW,
            fetchImpl: fetchImpl as unknown as typeof fetch, timeoutMs: 10, ...freshStores(),
        });

        expect(res).toEqual({ suggestions: [], reason: 'timeout' });
    });

    it('мусор вместо ответа не роняет разбор', async () => {
        const fetchImpl = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ suggestions: 'не массив' }) }) as unknown as Response);

        const res = await suggestAddresses({ userId: 'psy-1', query: 'Яузская', token: TOKEN, now: NOW, fetchImpl: fetchImpl as unknown as typeof fetch, ...freshStores() });

        expect(res.suggestions).toEqual([]);
    });

    it('неудача не кэшируется — следующая попытка идёт в DaData', async () => {
        const stores = freshStores();
        const fetchImpl = vi.fn()
            .mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) } as unknown as Response)
            .mockResolvedValueOnce(dadataResponse(['Москва, Яузская, 5']));

        await suggestAddresses({ userId: 'psy-1', query: 'Яузская', token: TOKEN, now: NOW, fetchImpl: fetchImpl as unknown as typeof fetch, ...stores });
        const second = await suggestAddresses({ userId: 'psy-1', query: 'Яузская', token: TOKEN, now: NOW + 100, fetchImpl: fetchImpl as unknown as typeof fetch, ...stores });

        expect(second.reason).toBe('ok');
        expect(second.suggestions).toHaveLength(1);
    });
});

describe('наружу отдаётся только то, что нужно полю адреса', () => {
    it('поля ответа DaData не пробрасываются целиком', async () => {
        const fetchImpl = vi.fn(async () => dadataResponse(['Москва, Яузская, 5']));

        const res = await suggestAddresses({ userId: 'psy-1', query: 'Яузская', token: TOKEN, now: NOW, fetchImpl: fetchImpl as unknown as typeof fetch, ...freshStores() });

        expect(res.suggestions).toEqual([{
            value: 'Москва, Яузская, 5',
            data: { fias_id: 'fias-1', city: 'Москва', street: 'Яузская', house: '5', block: undefined, region: 'Москва' },
        }]);
        expect(Object.keys(res.suggestions[0].data)).not.toContain('extra');
    });

    it('подсказка без значения отбрасывается', async () => {
        const fetchImpl = vi.fn(async () => ({
            ok: true, status: 200,
            json: async () => ({ suggestions: [{ data: {} }, null, { value: 'Москва, Яузская, 5', data: {} }] }),
        }) as unknown as Response);

        const res = await suggestAddresses({ userId: 'psy-1', query: 'Яузская', token: TOKEN, now: NOW, fetchImpl: fetchImpl as unknown as typeof fetch, ...freshStores() });

        expect(res.suggestions.map(s => s.value)).toEqual(['Москва, Яузская, 5']);
    });

    it('запрос уходит в DaData с ограничением по России и без лишнего', async () => {
        const fetchImpl = vi.fn(async () => dadataResponse([]));

        await suggestAddresses({ userId: 'psy-1', query: 'Яузская', token: TOKEN, now: NOW, fetchImpl: fetchImpl as unknown as typeof fetch, ...freshStores() });

        const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
        expect(url).toBe('https://suggestions.dadata.ru/suggestions/api/4_1/rs/suggest/address');
        expect((init.headers as Record<string, string>).Authorization).toBe(`Token ${TOKEN}`);
        expect(JSON.parse(init.body as string)).toEqual({ query: 'Яузская', count: 7, locations: [{ country: 'Россия' }] });
    });
});
