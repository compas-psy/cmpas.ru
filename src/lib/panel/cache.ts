/**
 * Кеш панели: значения считаются не чаще раза в 5 минут, кнопка «Обновить»
 * в шапке экрана сбрасывает кеш конкретного экрана (ТЗ §4).
 *
 * Собственной таблицы снимков не заводим — `unstable_cache` уже даёт и TTL,
 * и теги для точечного сброса (ТЗ §1: «ни одного нового способа делать то,
 * что уже делается»).
 */

import { unstable_cache } from 'next/cache';
import type { ScreenKey } from './screens';

/** Пять минут — минимальный интервал пересчёта экрана. */
export const PANEL_TTL_SECONDS = 300;

export function screenTag(screen: ScreenKey): string {
    return `panel:${screen}`;
}

/**
 * Оборачивает сборщик экрана в кеш с тегом этого экрана.
 * `keyParts` разводит варианты одного экрана (например `?p=practice`).
 */
export function cachedScreen<A extends unknown[], R>(
    screen: ScreenKey,
    keyParts: string[],
    build: (...args: A) => Promise<R>,
): (...args: A) => Promise<R> {
    return unstable_cache(build, ['panel', screen, ...keyParts], {
        tags: [screenTag(screen)],
        revalidate: PANEL_TTL_SECONDS,
    });
}
