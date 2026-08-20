/**
 * Категориальная палитра панели — шесть слотов без цикла (ТЗ §3.1 п.3, п.8).
 *
 * Цвет закреплён за сущностью, а не за местом в списке: фильтр, меняющий
 * состав рядов, не имеет права перекрасить выживших. Поэтому слот выбирается
 * по ключу сущности, а не по индексу в массиве данных.
 *
 * Значения самих цветов живут только в `src/app/admin/panel/panel.css`
 * (токены `--c1`…`--c6`); здесь — их имена и правила сочетаемости.
 */

export const PALETTE_SLOTS = {
    practice: 'c1',
    zapiski: 'c2',
    momenty: 'c3',
    platform: 'c4',
    reserve5: 'c5',
    reserve6: 'c6',
} as const;

export type PaletteEntity = keyof typeof PALETTE_SLOTS;
export type PaletteSlot = (typeof PALETTE_SLOTS)[PaletteEntity];

/** CSS-переменная слота. Единственный способ получить цвет ряда. */
export function slotVar(entity: PaletteEntity): string {
    return `var(--${PALETTE_SLOTS[entity]})`;
}

/**
 * Пары слотов, НЕ различимые цветом при дальтонизме или при обычном зрении.
 *
 * Получено прогоном `dataviz/scripts/validate_palette.js --pairs all`
 * отдельно для светлой (поверхность `--p-card` #FFFFFF) и тёмной
 * (#151F1A) темы — отчёт в `docs/panel/palette-report.md`. Это не оценка
 * на глаз: например c1↔c4 дают ΔE 0.7 при дейтеранопии, то есть для
 * дейтераноп это один и тот же цвет.
 *
 * Такую пару разрешено рисовать в одном графике ТОЛЬКО со вторым каналом
 * различения: штрих, прямая подпись, позиция или разделяющий зазор.
 */
export const UNSAFE_SLOT_PAIRS: ReadonlyArray<readonly [PaletteSlot, PaletteSlot]> = [
    ['c1', 'c4'],
    ['c1', 'c6'],
    ['c2', 'c4'],
    ['c2', 'c6'],
    ['c3', 'c5'],
];

function pairKey(a: PaletteSlot, b: PaletteSlot): string {
    return [a, b].sort().join('|');
}

const UNSAFE = new Set(UNSAFE_SLOT_PAIRS.map(([a, b]) => pairKey(a, b)));

export function isSafePair(a: PaletteSlot, b: PaletteSlot): boolean {
    return a === b || !UNSAFE.has(pairKey(a, b));
}

/**
 * Второй канал различения рядов, помимо цвета. `none` допустим только для
 * набора слотов, где все пары различимы цветом.
 */
export type SecondaryEncoding = 'none' | 'dash' | 'position' | 'direct-label';

/**
 * Проверяет набор рядов одного графика. Возвращает список нарушений —
 * пустой список означает «можно рисовать». Вызывается тестом
 * `src/lib/panel/__tests__/palette.test.ts` для каждого графика панели.
 */
export function checkSeries(slots: PaletteSlot[], secondary: SecondaryEncoding): string[] {
    if (secondary !== 'none') return [];
    const problems: string[] = [];
    for (let i = 0; i < slots.length; i += 1) {
        for (let j = i + 1; j < slots.length; j += 1) {
            if (!isSafePair(slots[i], slots[j])) {
                problems.push(
                    `${slots[i]} и ${slots[j]} не различимы цветом — нужен второй канал (штрих, подпись или позиция)`,
                );
            }
        }
    }
    return problems;
}

/**
 * Реестр графиков панели: какие слоты и с каким вторым каналом.
 * Тест палитры проходит по этому реестру, чтобы новый график нельзя было
 * добавить в обход проверки.
 */
export const CHART_SERIES_REGISTRY: ReadonlyArray<{
    chart: string;
    slots: PaletteSlot[];
    secondary: SecondaryEncoding;
    note: string;
}> = [
    { chart: 'q_mrr_monthly', slots: ['c1'], secondary: 'none', note: 'одна серия, одна ось' },
    { chart: 'q_sessions_weekly (спарклайн)', slots: ['c1'], secondary: 'none', note: 'одна серия' },
    {
        chart: 'q_mrr_waterfall',
        slots: ['c1', 'c4'],
        secondary: 'position',
        note: 'прирост вправо от центра, потеря влево — цвет здесь дублирует позицию и подпись строки',
    },
    { chart: 'q_funnel_practice', slots: ['c1'], secondary: 'none', note: 'один тон, убывающая непрозрачность' },
    { chart: 'q_funnel_booking', slots: ['c3'], secondary: 'none', note: 'один тон' },
    { chart: 'q_practice_booking_author', slots: ['c1'], secondary: 'direct-label', note: 'второй сегмент — --p-inset, не цвет ряда' },
    { chart: 'q_cohorts_practice', slots: [], secondary: 'none', note: 'последовательная шкала --heat, один тон от светлого к тёмному' },
    {
        chart: 'q_retention_momenty',
        slots: ['c3', 'c3'],
        secondary: 'dash',
        note: 'две когорты одним тоном, различаются штрихом и прямой подписью',
    },
    { chart: 'q_zapiski_storage', slots: ['c2'], secondary: 'none', note: 'один тон, убывающая непрозрачность' },
];
