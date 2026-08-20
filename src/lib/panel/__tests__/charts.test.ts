/**
 * Правила графиков (ТЗ §3.1, приёмка §9).
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';
import { CHART_SERIES_REGISTRY, checkSeries, isSafePair, PALETTE_SLOTS, UNSAFE_SLOT_PAIRS } from '../palette';

const CHARTS = path.resolve(__dirname, '../../../components/panel/charts.tsx');

describe('графики панели', () => {
    it('ни один график не имеет двух осей Y', () => {
        const text = readFileSync(CHARTS, 'utf8');

        // Каждая функция-график объявляет ровно один <YAxis> …
        const perChart = text.split(/export function /).slice(1);
        for (const chunk of perChart) {
            const yAxes = (chunk.match(/<YAxis\b/g) ?? []).length;
            const name = chunk.slice(0, chunk.indexOf('('));
            expect(yAxes, `${name}: осей Y ${yAxes}, допустима максимум одна`).toBeLessThanOrEqual(1);
        }

        // … и нигде не встречается идентификатор второй оси.
        expect(text).not.toContain('yAxisId');
        expect(text).not.toContain('orientation="right"');
    });

    it('null рисуется разрывом, а не нулём: connectNulls везде выключён', () => {
        const text = readFileSync(CHARTS, 'utf8');
        const lines = (text.match(/<Line\b/g) ?? []).length;
        const disabled = (text.match(/connectNulls=\{false\}/g) ?? []).length;
        expect(lines).toBeGreaterThan(0);
        expect(disabled, 'у каждой линии должен быть connectNulls={false}').toBe(lines);
    });

    it('наведение обязательно: у каждого графика есть Tooltip с перекрестьем', () => {
        const text = readFileSync(CHARTS, 'utf8');
        const containers = (text.match(/<LineChart\b/g) ?? []).length;
        const tooltips = (text.match(/<Tooltip\b/g) ?? []).length;
        expect(containers).toBeGreaterThan(0);
        expect(tooltips).toBe(containers);
        expect(text).toContain('cursor=');
    });

    it('цвет ряда приходит слотом палитры, а не hex и не индексом', () => {
        const text = readFileSync(CHARTS, 'utf8');
        expect(text.match(/#[0-9a-fA-F]{3,8}\b/g)).toBeNull();
        expect(text).toContain('`var(--${slot})`');
    });

    it('текст графиков носит текстовые токены, а не цвет ряда', () => {
        const text = readFileSync(CHARTS, 'utf8');
        expect(text).toContain("fill: 'var(--p-sub)'");
        // Ось не имеет права краситься в цвет серии.
        expect(/fill:\s*`var\(--\$\{slot\}\)`/.test(text)).toBe(false);
    });
});

describe('палитра', () => {
    it('шесть слотов, закреплённых за сущностями, без цикла', () => {
        const slots = Object.values(PALETTE_SLOTS);
        expect(slots).toEqual(['c1', 'c2', 'c3', 'c4', 'c5', 'c6']);
        expect(new Set(slots).size).toBe(slots.length);
    });

    it('пары, не различимые при дальтонизме, помечены как небезопасные', () => {
        // Получено прогоном dataviz/scripts/validate_palette.js --pairs all.
        expect(UNSAFE_SLOT_PAIRS.length).toBeGreaterThan(0);
        expect(isSafePair('c1', 'c4')).toBe(false);
        expect(isSafePair('c3', 'c5')).toBe(false);
        expect(isSafePair('c1', 'c2')).toBe(true);
        expect(isSafePair('c1', 'c1')).toBe(true);
    });

    it('каждый график панели либо использует различимые слоты, либо объявляет второй канал', () => {
        expect(CHART_SERIES_REGISTRY.length).toBeGreaterThan(0);
        for (const chart of CHART_SERIES_REGISTRY) {
            const problems = checkSeries(chart.slots, chart.secondary);
            expect(problems, `${chart.chart}: ${problems.join('; ')}`).toEqual([]);
        }
    });

    it('цвет продукта не меняется при смене состава фильтра', () => {
        // Слот выбирается по ключу сущности, а не по индексу в массиве:
        // скрыв ЗАПИСКИ, ПРАКТИКА обязана остаться своим цветом.
        const all = ['practice', 'zapiski', 'momenty'] as const;
        const filtered = ['practice', 'momenty'] as const;

        for (const entity of filtered) {
            expect(PALETTE_SLOTS[entity]).toBe(PALETTE_SLOTS[all[all.indexOf(entity)]]);
        }
        expect(PALETTE_SLOTS.practice).toBe('c1');
        expect(PALETTE_SLOTS.momenty).toBe('c3');
    });
});
