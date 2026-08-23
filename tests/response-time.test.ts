// q_tech_response_p95 (ТЗ §5, экран 6) был пуст, потому что источника не
// было вовсе. Эти тесты покрывают счёт перцентиля, окно-буфер, запись
// агрегата и честное "устарело" на стороне коллектора.

import { describe, it, expect, vi } from 'vitest';
import {
    percentile,
    recordRequestDuration,
    summarizeDurations,
    flushDurations,
    persistResponseTimeWindow,
    readResponseP95,
    RESPONSE_TIME_STALE_MINUTES,
} from '@/lib/infra-pulse/response-time';

describe('percentile (O-260817-12/§5, nearest-rank)', () => {
    it('null на пустом наборе', () => {
        expect(percentile([], 95)).toBeNull();
    });

    it('единственное значение — оно и есть любой перцентиль', () => {
        expect(percentile([42], 50)).toBe(42);
        expect(percentile([42], 95)).toBe(42);
        expect(percentile([42], 99)).toBe(42);
    });

    it('p50 на нечётном наборе — средний элемент', () => {
        expect(percentile([10, 30, 20], 50)).toBe(20);
    });

    it('p95 на 100 значениях 1..100 — 95-й по возрастанию', () => {
        const values = Array.from({ length: 100 }, (_, i) => i + 1); // 1..100
        expect(percentile(values, 95)).toBe(95);
        expect(percentile(values, 50)).toBe(50);
        expect(percentile(values, 99)).toBe(99);
    });

    it('не мутирует исходный массив (сортирует копию)', () => {
        const values = [30, 10, 20];
        percentile(values, 50);
        expect(values).toEqual([30, 10, 20]);
    });

    it('устойчив к порядку — результат не зависит от того, отсортирован ли вход', () => {
        const sorted = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
        const shuffled = [7, 2, 9, 4, 1, 10, 3, 8, 5, 6];
        expect(percentile(shuffled, 95)).toBe(percentile(sorted, 95));
    });
});

describe('recordRequestDuration / summarizeDurations (буфер длительностей)', () => {
    it('null на пустом буфере', () => {
        expect(summarizeDurations([])).toBeNull();
    });

    it('копит замеры и считает p50/p95/p99 и sampleCount', () => {
        const store: number[] = [];
        for (const ms of [100, 120, 90, 200, 5000, 110, 95, 130, 105, 115]) {
            recordRequestDuration(ms, store);
        }
        const summary = summarizeDurations(store);
        expect(summary?.sampleCount).toBe(10);
        expect(summary?.p95Ms).toBe(5000); // аномалия честно видна в p95, не размывается
        expect(summary?.p50Ms).toBeGreaterThan(90);
    });

    it('игнорирует отрицательные и нечисловые значения — не засоряет буфер', () => {
        const store: number[] = [];
        recordRequestDuration(100, store);
        recordRequestDuration(-5, store);
        recordRequestDuration(NaN, store);
        recordRequestDuration(Infinity, store);
        expect(store).toEqual([100]);
    });

    it('буфер ограничен: очень длинное окно не растёт бесконечно', () => {
        const store: number[] = [];
        for (let i = 0; i < 5100; i++) recordRequestDuration(1, store, 5000);
        expect(store.length).toBe(5000);
    });
});

describe('flushDurations (окно, ТЗ §5)', () => {
    it('null и не трогает буфер, если он уже пуст', () => {
        const store: number[] = [];
        expect(flushDurations(store)).toBeNull();
        expect(store).toEqual([]);
    });

    it('снимает окно и опустошает буфер — следующий вызов видит уже пустое окно', () => {
        const store = [100, 200, 300];
        const first = flushDurations(store);
        expect(first?.sampleCount).toBe(3);
        expect(store).toEqual([]);
        expect(flushDurations(store)).toBeNull();
    });
});

describe('persistResponseTimeWindow (пишет AppResponseTime)', () => {
    it('пустое окно — ничего не пишет, это не сбой', async () => {
        const create = vi.fn();
        const wrote = await persistResponseTimeWindow({ appResponseTime: { create } } as any, new Date(), new Date(), []);
        expect(wrote).toBe(false);
        expect(create).not.toHaveBeenCalled();
    });

    it('непустое окно — пишет одну строку с перцентилями и опустошает буфер', async () => {
        const create = vi.fn().mockResolvedValue({});
        const store = [100, 200, 300, 400, 500];
        const windowStart = new Date('2026-08-23T09:00:00Z');
        const windowEnd = new Date('2026-08-23T09:05:00Z');

        const wrote = await persistResponseTimeWindow({ appResponseTime: { create } } as any, windowStart, windowEnd, store);

        expect(wrote).toBe(true);
        expect(store).toEqual([]);
        expect(create).toHaveBeenCalledWith({
            data: { windowStart, windowEnd, sampleCount: 5, p50Ms: 300, p95Ms: 500, p99Ms: 500 },
        });
    });
});

describe('readResponseP95 (сторона коллектора — только чтение)', () => {
    it('null, если строк ещё не было', async () => {
        const findFirst = vi.fn().mockResolvedValue(null);
        const result = await readResponseP95({ appResponseTime: { findFirst } } as any);
        expect(result).toBeNull();
    });

    it('возвращает p95 последнего окна, когда оно свежее', async () => {
        const now = new Date('2026-08-23T10:00:00Z');
        const findFirst = vi.fn().mockResolvedValue({ p95Ms: 250, windowEnd: new Date('2026-08-23T09:58:00Z') });
        const result = await readResponseP95({ appResponseTime: { findFirst } } as any, now);
        expect(result).toBe(250);
        expect(findFirst).toHaveBeenCalledWith({ orderBy: { windowEnd: 'desc' } });
    });

    it('null, если последнее окно старше порога свежести — не выдумываем актуальность', async () => {
        const now = new Date('2026-08-23T10:00:00Z');
        const staleAt = new Date(now.getTime() - (RESPONSE_TIME_STALE_MINUTES + 1) * 60_000);
        const findFirst = vi.fn().mockResolvedValue({ p95Ms: 250, windowEnd: staleAt });
        const result = await readResponseP95({ appResponseTime: { findFirst } } as any, now);
        expect(result).toBeNull();
    });

    it('null, если p95Ms в последней строке сам null (окно было, но пустое — не должно случаться, но не должно и падать)', async () => {
        const findFirst = vi.fn().mockResolvedValue({ p95Ms: null, windowEnd: new Date() });
        const result = await readResponseP95({ appResponseTime: { findFirst } } as any);
        expect(result).toBeNull();
    });
});
