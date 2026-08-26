// Находка №2 сверх аудита: шесть карточек МОМЕНТОВ (q_momenty_nsm,
// q_momenty_installs, q_momenty_d1, q_momenty_d7, q_momenty_d30 в
// products.ts, и q_retention_momenty в retention.ts) были пусты по ШЕСТИ
// слегка разным текстам, хотя причина ровно одна: транспорт МОМЕНТОВ
// только что включили, app_installed от продукта ещё не приходило ни разу.
// «Если у группы блоков одна причина пустоты, она называется один раз»
// (решение учредителя). Этот тест подаёт во все шесть функций состояние
// «установок не было ни разу» и проверяет, что reason у всех БУКВАЛЬНО
// совпадает — со строкой MOMENTY_NOT_LAUNCHED_REASON.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const findMany = vi.fn();
const count = vi.fn();
const findFirst = vi.fn();

vi.mock('@/lib/db', () => ({
    db: {
        analyticsEvent: {
            findMany: (...args: unknown[]) => findMany(...args),
            count: (...args: unknown[]) => count(...args),
            findFirst: (...args: unknown[]) => findFirst(...args),
        },
    },
}));

import {
    qMomentyNsm,
    qMomentyInstalls,
    qMomentyD1,
    qMomentyD7,
    qMomentyD30,
    MOMENTY_NOT_LAUNCHED_REASON,
} from '@/lib/panel/queries/products';
import { qRetentionMomenty } from '@/lib/panel/queries/retention';

beforeEach(() => {
    findMany.mockReset();
    count.mockReset();
    findFirst.mockReset();
    // Ни одной установки МОМЕНТОВ не было никогда — общее состояние для всех шести.
    findMany.mockResolvedValue([]);
    count.mockResolvedValue(0);
    findFirst.mockResolvedValue(null);
});

describe('шесть карточек МОМЕНТОВ — одна причина, буквально одинаковый текст', () => {
    it('q_momenty_nsm', async () => {
        const block = await qMomentyNsm();
        expect(block.state).toBe('no_data');
        expect(block.reason).toBe(MOMENTY_NOT_LAUNCHED_REASON);
    });

    it('q_momenty_installs', async () => {
        const block = await qMomentyInstalls();
        expect(block.state).toBe('no_data');
        expect(block.reason).toBe(MOMENTY_NOT_LAUNCHED_REASON);
    });

    it('q_momenty_d1 / d7 / d30', async () => {
        const [d1, d7, d30] = await Promise.all([qMomentyD1(), qMomentyD7(), qMomentyD30()]);
        for (const block of [d1, d7, d30]) {
            expect(block.state).toBe('no_data');
            expect(block.reason).toBe(MOMENTY_NOT_LAUNCHED_REASON);
        }
    });

    it('q_retention_momenty (экран «Удержание») — тот же текст, что и у products.ts', async () => {
        const block = await qRetentionMomenty();
        expect(block.state).toBe('no_data');
        expect(block.reason).toBe(MOMENTY_NOT_LAUNCHED_REASON);
    });

    it('D1/D7/D30 всё же различают "не запускались ни разу" от "запустились, но истории мало" — вторая причина остаётся своей', async () => {
        // Установка была 2 дня назад — D7 ещё физически недостижим (нужно 8 дней истории),
        // но это НЕ "не запускались" — это "растут". Разные причины не должны схлопнуться в одну.
        findFirst.mockResolvedValue({ ts: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) });
        const d7 = await qMomentyD7();
        expect(d7.state).toBe('no_data');
        expect(d7.reason).not.toBe(MOMENTY_NOT_LAUNCHED_REASON);
        expect(d7.reason).toMatch(/истори/i);
    });
});
