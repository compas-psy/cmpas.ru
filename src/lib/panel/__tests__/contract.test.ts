/**
 * Контракт `PanelBlock` (ТЗ §4) и правила приёмки §9, касающиеся состояний.
 */

import { describe, expect, it, vi } from 'vitest';
import { broken, countHonestHoles, guard, loading, noData, ok, stale, type PanelBlock } from '../types';

describe('контракт PanelBlock', () => {
    it('ok несёт данные, пустую причину и время расчёта', () => {
        const block = ok('q_demo', { value: 12 });
        expect(block.state).toBe('ok');
        expect(block.data).toEqual({ value: 12 });
        expect(block.reason).toBeNull();
        expect(block.generatedAt).not.toBeNull();
        expect(block.source).toBe('q_demo');
    });

    it('измеренный ноль — это состояние ok с данными, а не no_data', () => {
        const block = ok('q_demo', { value: 0 });
        expect(block.state).toBe('ok');
        expect(block.data).toEqual({ value: 0 });
    });

    it('no_data не несёт данных и обязан объяснить причину', () => {
        const block = noData('q_demo', 'приёмник выключен с 12.08');
        expect(block.state).toBe('no_data');
        expect(block.data).toBeNull();
        expect(block.reason).toBe('приёмник выключен с 12.08');
    });

    it.each(['', '   '])('пустая причина недопустима: %j', (empty) => {
        expect(() => noData('q_demo', empty)).toThrow(/reason обязателен/);
        expect(() => broken('q_demo', empty)).toThrow(/reason обязателен/);
        expect(() => stale('q_demo', {}, empty, null)).toThrow(/reason обязателен/);
    });

    it('stale несёт и данные, и причину устаревания', () => {
        const at = new Date().toISOString();
        const block = stale('q_demo', { value: 7 }, 'коллектор молчит 3 ч', at);
        expect(block.state).toBe('stale');
        expect(block.data).toEqual({ value: 7 });
        expect(block.reason).toBe('коллектор молчит 3 ч');
        expect(block.generatedAt).toBe(at);
    });

    it('loading — единственное состояние без причины и без данных', () => {
        const block = loading('q_demo');
        expect(block.state).toBe('loading');
        expect(block.data).toBeNull();
        expect(block.reason).toBeNull();
    });

    it('падение одного запроса не роняет экран: блок приходит как broken', async () => {
        const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
        const result = await guard('q_boom', async () => {
            throw new Error('таймаут запроса к базе');
        });
        spy.mockRestore();

        expect(result.state).toBe('broken');
        expect(result.source).toBe('q_boom');
        expect(result.reason).toContain('таймаут запроса к базе');
        expect(result.data).toBeNull();
    });

    it('guard пропускает удачный запрос без изменений', async () => {
        const result = await guard('q_fine', async () => ok('q_fine', 42));
        expect(result.state).toBe('ok');
        expect(result.data).toBe(42);
    });

    it('честные дыры считаются только по no_data', () => {
        const payload: Record<string, PanelBlock<unknown>> = {
            a: ok('q_a', 1),
            b: noData('q_b', 'нет источника'),
            c: noData('q_c', 'нет источника'),
            d: broken('q_d', 'упал'),
            e: stale('q_e', 1, 'устарело', null),
        };
        expect(countHonestHoles(payload)).toBe(2);
    });
});
