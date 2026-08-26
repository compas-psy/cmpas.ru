// B5: q_sources раньше был жёстко закодирован как no_data — "utm лежит в
// VisitorAnalytics по отпечатку устройства, связать с аккаунтом нечем".
// После связки VisitorAnalytics.accountId (миграция 20260823100000,
// src/auth.ts) источник для СВЯЗАННЫХ визитов уже можно посчитать; для
// аккаунтов без связанного визита (регистрация до этой миграции, либо
// первый визит не долетел до /api/analytics) источник по-прежнему неизвестен
// — это остаётся честным пробелом, не ложным нулём.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const findMany = vi.fn();
const count = vi.fn();
vi.mock('@/lib/db', () => ({
    db: {
        visitorAnalytics: {
            findMany: (...args: unknown[]) => findMany(...args),
            count: (...args: unknown[]) => count(...args),
        },
    },
}));

import { qSources } from '@/lib/panel/queries/funnel';

beforeEach(() => {
    findMany.mockReset();
    count.mockReset();
    count.mockResolvedValue(0); // по умолчанию: utm-визитов тоже нет, если тест не переопределил
});

describe('qSources (B5)', () => {
    it('ни один визит не связан с аккаунтом и ни у одного визита нет utm — no_data, а не пустая таблица источников', async () => {
        findMany.mockResolvedValue([]);
        count.mockResolvedValue(0);
        const block = await qSources();
        expect(block.state).toBe('no_data');
        expect(block.data).toBeNull();
    });

    it('есть связанные визиты — ok с разбивкой по utm-источнику', async () => {
        findMany.mockResolvedValue([
            { accountId: 'u1', utmSource: 'vk' },
            { accountId: 'u2', utmSource: 'vk' },
            { accountId: 'u3', utmSource: null },
        ]);
        count.mockResolvedValue(3);
        const block = await qSources();
        expect(block.state).toBe('ok');
        expect(block.data?.totalLinked).toBe(3);
        const vk = block.data?.sources.find((s) => s.source === 'vk');
        expect(vk?.accounts).toBe(2);
        const noLabel = block.data?.sources.find((s) => s.source === 'без метки');
        expect(noLabel?.accounts).toBe(1);
    });

    it('один аккаунт связан с двумя устройствами — считается один раз, по самому раннему визиту (first-touch)', async () => {
        // orderBy: createdAt asc — мок отдаёт уже в этом порядке.
        findMany.mockResolvedValue([
            { accountId: 'u1', utmSource: 'vk' }, // первый визит этого аккаунта — источник vk
            { accountId: 'u1', utmSource: 'telegram_ads' }, // второе устройство того же человека, позже
        ]);
        count.mockResolvedValue(2);
        const block = await qSources();
        expect(block.state).toBe('ok');
        expect(block.data?.totalLinked).toBe(1);
        expect(block.data?.sources).toEqual([{ source: 'vk', accounts: 1 }]);
    });

    it('B-класс: 0 визитов привязано к аккаунту, но 9 несут utm-метку — ok с честным нулём привязки, не no_data', async () => {
        findMany.mockResolvedValue([]); // accountId ещё ни у одного визита не проставлен
        count.mockResolvedValue(9); // но utmSource на визитах уже есть
        const block = await qSources();
        expect(block.state).toBe('ok');
        expect(block.data).toMatchObject({ totalLinked: 0, sources: [], visitsWithUtm: 9 });
    });
});
