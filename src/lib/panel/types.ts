/**
 * Контракт данных панели (ТЗ §4).
 *
 * Каждый блок панели — не «число», а число вместе со своим состоянием и
 * происхождением. Три правила, нарушение любого — брак:
 *
 *  1. `no_data` никогда не рисуется как ноль. Ноль — это измеренный ноль.
 *  2. `reason` обязателен для всех состояний, кроме `ok`.
 *  3. `source` печатается на экране моноширинным 11px под блоком.
 */

import { redact } from './redact';

export type BlockState = 'ok' | 'loading' | 'no_data' | 'stale' | 'broken';

export interface PanelBlock<T> {
    /** Данные блока. null во всех состояниях, кроме ok и stale. */
    data: T | null;
    state: BlockState;
    /** Идентификатор запроса — печатается в подписи под блоком. */
    source: string;
    /** Когда данные посчитаны, ISO. Печатается как время в подписи. */
    generatedAt: string | null;
    /** Человеческая причина для no_data / stale / broken. Обязательна. */
    reason: string | null;
}

/**
 * Лампа состояния на «Утре» — шесть значений.
 * `unverified` — не зелёный, серый с пунктиром: это не «хорошо».
 */
export type LampState = 'ok' | 'warning' | 'serious' | 'broken' | 'unverified' | 'loading';

export interface LampData {
    /** Короткое состояние словом: «в порядке», «внимание», … */
    label: string;
    lamp: LampState;
    /** Уточнение под названием: «списания 96,1 %». */
    detail: string;
    /** Куда ведёт клик по лампе. */
    href: string;
}

/** Пункт списка «требует вас» — формулируется через последствие, не через метрику. */
export interface AttentionItem {
    id: string;
    title: string;
    /** Последствие: «следующая выкладка упадёт молча», а не «расхождение 2». */
    consequence: string;
    /** Оценка времени в минутах. */
    minutes: number;
    lamp: Exclude<LampState, 'loading'>;
    action: { label: string; href: string } | null;
}

const ISO_NOW = () => new Date().toISOString();

/** Блок с данными. Ноль здесь — измеренный ноль, а не отсутствие данных. */
export function ok<T>(source: string, data: T, generatedAt: string = ISO_NOW()): PanelBlock<T> {
    return { data, state: 'ok', source, generatedAt, reason: null };
}

/**
 * Данных нет. `reason` обязателен — «данных нет» без объяснения бесполезно,
 * поэтому пустая строка здесь падает, а не проходит молча.
 */
export function noData<T>(source: string, reason: string, generatedAt: string | null = ISO_NOW()): PanelBlock<T> {
    assertReason(source, reason);
    return { data: null, state: 'no_data', source, generatedAt, reason };
}

/** Данные есть, но старее допустимого. Блок гасится и подписывается временем. */
export function stale<T>(source: string, data: T, reason: string, generatedAt: string | null): PanelBlock<T> {
    assertReason(source, reason);
    return { data, state: 'stale', source, generatedAt, reason };
}

/** Запрос упал. Экран при этом не падает (ТЗ §4, «API»). */
export function broken<T>(source: string, reason: string): PanelBlock<T> {
    assertReason(source, reason);
    return { data: null, state: 'broken', source, generatedAt: null, reason };
}

/** Заготовка под скелетон — используется библиотекой компонентов. */
export function loading<T>(source: string): PanelBlock<T> {
    return { data: null, state: 'loading', source, generatedAt: null, reason: null };
}

function assertReason(source: string, reason: string): void {
    if (!reason || !reason.trim()) {
        throw new Error(`PanelBlock ${source}: reason обязателен для состояния, отличного от ok`);
    }
}

/**
 * Обёртка вокруг одного запроса блока: падение одного блока не роняет экран.
 * Каждый запрос оборачивается на уровне блока, а не экрана (ТЗ §4).
 */
export async function guard<T>(source: string, fn: () => Promise<PanelBlock<T>>): Promise<PanelBlock<T>> {
    try {
        return await fn();
    } catch (error) {
        // Текст ошибки на экран идёт вычищенным: Prisma вставляет в него и
        // фрагмент запроса, и значения параметров (ТЗ §8).
        const raw = error instanceof Error ? error.message : String(error);
        const note = redact(raw) ?? 'причина не определена';
        console.error(`[panel] ${source} упал:`, error);
        return broken<T>(source, `запрос падает: ${note}`);
    }
}

/** Экран целиком: имя блока → PanelBlock. */
export type ScreenPayload = Record<string, PanelBlock<unknown>>;

/** Считает «честные дыры» — блоки в состоянии no_data. */
export function countHonestHoles(payload: ScreenPayload): number {
    return Object.values(payload).filter((block) => block.state === 'no_data').length;
}

/** Достаёт блок из ответа экрана с нужным типом данных. */
export function pick<T>(payload: ScreenPayload, key: string): PanelBlock<T> {
    const found = payload[key];
    if (!found) return broken<T>(key, 'блок отсутствует в ответе экрана');
    return found as PanelBlock<T>;
}
