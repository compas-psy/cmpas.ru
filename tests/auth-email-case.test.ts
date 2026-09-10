// Регистр почты не должен заводить человеку вторую практику.
//
// Сторона СИМПАС просила разобраться с этим четыре раза (issue #132), и
// просила по делу. У них адрес хранится как введён, а единственность держится
// по lower(email); claim `email` уходит к нам в том виде, как человек набрал
// его у них. У нас же User.email — обычный уникальный индекс, а Postgres
// сравнивает посимвольно.
//
// Значит до этой правки: практик записан у нас как `Ivan@ya.ru`, в СИМПАС
// набирает `ivan@ya.ru` — поиск его не находит, allowDangerousEmailAccountLinking
// не связывает, а заводит НОВОГО пользователя ПРАКТИКИ. Человек входит и видит
// пустую практику вместо своей. Молча: ни ошибки, ни отказа.
//
// Здесь проверяется, что сравнение стало нечувствительным к регистру и что
// записанное при этом никто не переписывает — адрес человека остаётся таким,
// каким он его дал.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const findMany = vi.fn();
vi.mock('@/lib/db', () => ({ db: { user: { findMany: (...args: unknown[]) => findMany(...args) } } }));

beforeEach(() => {
    vi.clearAllMocks();
});

describe('приведение адреса к сравнимому виду', () => {
    it('снимает регистр и края', async () => {
        const { normalizeEmail } = await import('@/lib/auth/email-identity');
        expect(normalizeEmail('  Ivan@Ya.RU ')).toBe('ivan@ya.ru');
    });

    it('условие поиска — нечувствительное к регистру', async () => {
        const { insensitiveEmailWhere } = await import('@/lib/auth/email-identity');
        expect(insensitiveEmailWhere('Ivan@Ya.ru')).toEqual({
            email: { equals: 'ivan@ya.ru', mode: 'insensitive' },
        });
    });
});

describe('поиск человека по почте', () => {
    it('находит запись, отличающуюся только регистром', async () => {
        // Ровно живой случай: у нас `Ivan@ya.ru`, из СИМПАС пришло `ivan@ya.ru`.
        findMany.mockResolvedValue([{ id: 'u1', email: 'Ivan@ya.ru' }]);
        const { findUserByEmailInsensitive } = await import('@/lib/auth/email-identity');

        const user = await findUserByEmailInsensitive('ivan@ya.ru');

        expect(user?.id).toBe('u1');
        expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
            where: { email: { equals: 'ivan@ya.ru', mode: 'insensitive' } },
        }));
    });

    it('записанный адрес остаётся как есть — его никто не переписывает', async () => {
        findMany.mockResolvedValue([{ id: 'u1', email: 'Ivan@ya.ru' }]);
        const { findUserByEmailInsensitive } = await import('@/lib/auth/email-identity');

        const user = await findUserByEmailInsensitive('IVAN@YA.RU');

        expect(user?.email).toBe('Ivan@ya.ru');
    });

    it('никого нет — null, а не выдуманная запись', async () => {
        findMany.mockResolvedValue([]);
        const { findUserByEmailInsensitive } = await import('@/lib/auth/email-identity');

        expect(await findUserByEmailInsensitive('нет@такого.ru')).toBeNull();
    });

    it('если расхождение уже случилось — берётся САМАЯ СТАРАЯ запись', async () => {
        // Старшая — та, в которой лежит настоящая практика. Младшая появилась
        // как раз из-за регистра. Отдать младшую значило бы показать человеку
        // пустой кабинет — ровно то, от чего эта правка защищает.
        findMany.mockResolvedValue([
            { id: 'старая', email: 'Ivan@ya.ru' },
            { id: 'новая', email: 'ivan@ya.ru' },
        ]);
        const { findUserByEmailInsensitive } = await import('@/lib/auth/email-identity');

        const user = await findUserByEmailInsensitive('ivan@ya.ru');

        expect(user?.id).toBe('старая');
        expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
            orderBy: { createdAt: 'asc' },
        }));
    });

    it('о двойнике сказано в журнале — и БЕЗ адреса', async () => {
        // Двойник чинится руками: решать, какая из двух практик настоящая, код
        // не вправе. Но молчать об этом нельзя. В журнал идёт только число:
        // адрес — персональные данные, а журнал читают люди, которым карточек
        // этого человека не показывают.
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
        findMany.mockResolvedValue([
            { id: 'старая', email: 'Ivan@ya.ru' },
            { id: 'новая', email: 'ivan@ya.ru' },
        ]);
        const { findUserByEmailInsensitive } = await import('@/lib/auth/email-identity');

        await findUserByEmailInsensitive('ivan@ya.ru');

        expect(warn).toHaveBeenCalledTimes(1);
        const said = String(warn.mock.calls[0][0]);
        expect(said).toContain('2');
        expect(said).not.toContain('ya.ru');
        warn.mockRestore();
    });

    it('одна запись — журнал молчит', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
        findMany.mockResolvedValue([{ id: 'u1', email: 'ivan@ya.ru' }]);
        const { findUserByEmailInsensitive } = await import('@/lib/auth/email-identity');

        await findUserByEmailInsensitive('ivan@ya.ru');

        expect(warn).not.toHaveBeenCalled();
        warn.mockRestore();
    });
});
