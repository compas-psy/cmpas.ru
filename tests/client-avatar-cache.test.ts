/**
 * Кэш аватарок в памяти процесса.
 *
 * Дело не в скорости. У Telegram общий предел запросов НА БОТА, и упереться
 * в него из-за списка клиентов значит не «аватарки грузятся медленно», а
 * «уведомления клиентам не доходят»: бот тот же и лимит тот же.
 */

import { describe, it, expect } from 'vitest';
import { AvatarCache } from '@/lib/clients/avatar-cache';

const cacheAt = (clock: { t: number }, opts: Partial<{ maxEntries: number; hitTtlMs: number; missTtlMs: number }> = {}) =>
    new AvatarCache<string>({
        maxEntries: opts.maxEntries ?? 3,
        hitTtlMs: opts.hitTtlMs ?? 1000,
        missTtlMs: opts.missTtlMs ?? 100,
        now: () => clock.t,
    });

describe('кэш аватарок', () => {
    it('положили — достаём', () => {
        const clock = { t: 0 };
        const cache = cacheAt(clock);
        cache.set('c1', 'байты');
        expect(cache.get('c1')?.value).toBe('байты');
    });

    it('чего не клали, того нет', () => {
        expect(cacheAt({ t: 0 }).get('c1')).toBeUndefined();
    });

    it('«аватарки нет» — тоже ответ и тоже кэшируется', () => {
        // Иначе у человека с закрытым фото КАЖДЫЙ показ списка стучался бы
        // в мессенджер впустую.
        const cache = cacheAt({ t: 0 });
        cache.set('c1', null);
        expect(cache.get('c1')).toEqual({ value: null, expiresAt: expect.any(Number) });
    });

    it('срок у «нет» короче, чем у «есть»', () => {
        // Поставленную аватарку человек ждёт увидеть скоро; уже показанная
        // от лишнего часа жизни не портится.
        const clock = { t: 0 };
        const cache = cacheAt(clock, { hitTtlMs: 1000, missTtlMs: 100 });
        cache.set('есть', 'байты');
        cache.set('нет', null);
        clock.t = 200;
        expect(cache.get('нет')).toBeUndefined();
        expect(cache.get('есть')?.value).toBe('байты');
    });

    it('протухшее не отдаётся и не занимает место', () => {
        const clock = { t: 0 };
        const cache = cacheAt(clock);
        cache.set('c1', 'байты');
        clock.t = 1001;
        expect(cache.get('c1')).toBeUndefined();
        expect(cache.size).toBe(0);
    });

    it('переполнение вытесняет то, к чему дольше всего не обращались', () => {
        // Не «что положили раньше»: клиент, которого открывают каждый день,
        // иначе вылетал бы из кэша по возрасту, хотя нужен чаще прочих.
        const clock = { t: 0 };
        const cache = cacheAt(clock, { maxEntries: 2 });
        cache.set('старый-но-нужный', 'a');
        cache.set('второй', 'b');
        cache.get('старый-но-нужный');
        cache.set('третий', 'c');
        expect(cache.get('старый-но-нужный')?.value).toBe('a');
        expect(cache.get('второй')).toBeUndefined();
        expect(cache.size).toBe(2);
    });

    it('кэш не растёт бесконечно', () => {
        // Это память процесса, и её никто не чистит, кроме этого предела.
        const cache = cacheAt({ t: 0 }, { maxEntries: 3 });
        for (let i = 0; i < 50; i++) cache.set(`c${i}`, 'байты');
        expect(cache.size).toBe(3);
    });

    it('отвязал мессенджер — забыли сразу, не дожидаясь срока', () => {
        const cache = cacheAt({ t: 0 });
        cache.set('c1', 'байты');
        cache.forget('c1');
        expect(cache.get('c1')).toBeUndefined();
    });
});
