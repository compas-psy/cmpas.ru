/**
 * Общий обработчик API-маршрутов панели.
 *
 * GET  — отдаёт экран целиком: ключ = имя блока, значение = `PanelBlock`.
 * POST — сбрасывает кеш ровно этого экрана (кнопка «Обновить» в шапке).
 *
 * Роль проверяется на КАЖДОМ запросе, а не только в layout (ТЗ §2).
 */

import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { requirePanelAdmin } from '@/lib/panel/auth';
import { screenTag } from '@/lib/panel/cache';
import { screen, type ScreenResult } from '@/lib/panel/build';
import type { ScreenKey } from '@/lib/panel/screens';

export function panelGet(key: Exclude<ScreenKey, 'components' | 'products'>) {
    return async function GET() {
        const denied = await requirePanelAdmin();
        if (denied) return denied.response;

        try {
            return NextResponse.json(await screen(key));
        } catch (error) {
            return screenFailure(key, error);
        }
    };
}

export function panelPost(key: Exclude<ScreenKey, 'components'>) {
    return async function POST() {
        const denied = await requirePanelAdmin();
        if (denied) return denied.response;

        revalidateTag(screenTag(key), 'max');
        return NextResponse.json({ revalidated: key });
    };
}

/**
 * Экран не собрался целиком — это уже не «один блок упал», а отказ сборщика.
 * Отдаём 500 с причиной, чтобы фронт показал «сломано», а не пустую страницу.
 */
export function screenFailure(key: string, error: unknown): NextResponse {
    const reason = error instanceof Error ? error.message : String(error);
    console.error(`[panel] экран ${key} не собрался:`, error);
    return NextResponse.json({ error: 'screen_failed', screen: key, reason }, { status: 500 });
}

export type { ScreenResult };
