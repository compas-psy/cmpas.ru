/** Форматирование чисел и дат панели. Русская локаль, узкие неразрывные пробелы. */

const NUM = new Intl.NumberFormat('ru-RU');
const TIME = new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Moscow' });
const DATE = new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: '2-digit', timeZone: 'Europe/Moscow' });
const MONTH = new Intl.DateTimeFormat('ru-RU', { month: 'short', year: '2-digit', timeZone: 'Europe/Moscow' });

export function num(value: number): string {
    return NUM.format(value);
}

/** Дробное с фиксированной точностью — 96,1 вместо 96.1. */
export function dec(value: number, digits = 1): string {
    return value.toFixed(digits).replace('.', ',');
}

export function pct(value: number, digits = 1): string {
    return `${dec(value, digits)} %`;
}

/** Копейки → рубли, как их печатает панель. */
export function rub(kopecks: number): string {
    return num(Math.round(kopecks / 100));
}

export function timeOf(iso: string | null): string {
    if (!iso) return '—';
    return TIME.format(new Date(iso));
}

export function dateOf(iso: string | Date | null): string {
    if (!iso) return '—';
    return DATE.format(typeof iso === 'string' ? new Date(iso) : iso);
}

export function monthOf(iso: string | Date): string {
    return MONTH.format(typeof iso === 'string' ? new Date(iso) : iso).replace('.', '');
}

/** Часы → «6 д 4 ч» / «3 ч 10 м» — как в макете «Техники». */
export function duration(hours: number): string {
    if (hours >= 24) {
        const d = Math.floor(hours / 24);
        const h = Math.floor(hours % 24);
        return h > 0 ? `${d} д ${h} ч` : `${d} д`;
    }
    if (hours >= 1) {
        const h = Math.floor(hours);
        const m = Math.round((hours - h) * 60);
        return m > 0 ? `${h} ч ${m} м` : `${h} ч`;
    }
    return `${Math.round(hours * 60)} м`;
}

export function bytes(value: bigint | number | null): string {
    if (value === null) return '—';
    const n = typeof value === 'bigint' ? Number(value) : value;
    if (n >= 1024 ** 3) return `${dec(n / 1024 ** 3, 2)} ГБ`;
    if (n >= 1024 ** 2) return `${dec(n / 1024 ** 2, 0)} МБ`;
    if (n >= 1024) return `${dec(n / 1024, 0)} КБ`;
    return `${n} Б`;
}

/**
 * Направление изменения — всегда подписывается словом, а не только
 * стрелкой и цветом (handoff, экран «Утро»).
 */
export type Direction = 'up' | 'down' | 'flat';

export interface Delta {
    direction: Direction;
    /** Готовая подпись: «+8,3 %», «−3,1 п.п.», «без изменений». */
    label: string;
    /** Слово: «рост», «падение», «лучше», «хуже», «без изменений». */
    word: string;
    /** Хорошо ли это. Отдельно от направления: падение оттока — это «лучше». */
    good: boolean | null;
}

/** Относительное изменение в процентах. `higherIsBetter` задаёт знак смысла. */
export function deltaPercent(current: number, previous: number, higherIsBetter = true): Delta {
    if (previous === 0) {
        if (current === 0) return { direction: 'flat', label: 'без изменений', word: 'без изменений', good: null };
        return { direction: 'up', label: 'новое', word: 'появилось', good: higherIsBetter };
    }
    const change = ((current - previous) / previous) * 100;
    return buildDelta(change, `${signed(dec(Math.abs(change), 1))} %`, higherIsBetter, change);
}

/** Изменение в процентных пунктах — для показателей, которые сами проценты. */
export function deltaPoints(current: number, previous: number, higherIsBetter = true): Delta {
    const change = current - previous;
    return buildDelta(change, `${signed(dec(Math.abs(change), 1))} п.п.`, higherIsBetter, change);
}

/** Изменение в штуках. */
export function deltaAbs(current: number, previous: number, higherIsBetter = true): Delta {
    const change = current - previous;
    return buildDelta(change, signed(num(Math.abs(change))), higherIsBetter, change);
}

function signed(body: string): string {
    return body;
}

function buildDelta(change: number, magnitude: string, higherIsBetter: boolean, raw: number): Delta {
    if (Math.abs(raw) < 0.05) {
        return { direction: 'flat', label: 'без изменений', word: 'без изменений', good: null };
    }
    const up = change > 0;
    const good = higherIsBetter ? up : !up;
    return {
        direction: up ? 'up' : 'down',
        label: `${up ? '+' : '−'}${magnitude}`,
        word: good ? (up ? 'рост' : 'лучше') : up ? 'хуже' : 'падение',
        good,
    };
}

/** Русское склонение по числу: 1 пункт / 2 пункта / 5 пунктов. */
export function plural(n: number, one: string, few: string, many: string): string {
    const mod10 = n % 10;
    const mod100 = n % 100;
    if (mod10 === 1 && mod100 !== 11) return one;
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few;
    return many;
}
