/**
 * Чтение реестра событий `analytics/schema/events.yaml`.
 *
 * Реестр — единственный источник правды о том, какие события вообще могут
 * попасть в таблицу: всё, чего в нём нет, приёмник отвергает
 * (`src/lib/analytics/schema.ts`). Панель опирается на него, чтобы отличить
 * «событие не приходило» от «события не существует».
 *
 * Это независимый от src/lib/analytics/schema.ts построчный разбор (не
 * js-yaml) — он не тянет за собой Prisma-типы в клиентский бандл панели.
 * E1 (контракт контура v2 п.6): `product:` строки бывают либо простым
 * значением (`product: practice`), либо списком в одну строку
 * (`product: [practice, zapiski, moments]`) для consent_updated и
 * identity_linked — вторая форма разбирается ниже отдельно и отображается
 * как список через запятую, а не как одно значение.
 */

import { readFileSync } from 'fs';
import path from 'path';

let cache: Map<string, { product: string }> | null = null;

export function readEventRegistry(): Map<string, { product: string }> {
    if (cache) return cache;

    const file = path.join(process.cwd(), 'analytics', 'schema', 'events.yaml');
    const map = new Map<string, { product: string }>();

    try {
        const text = readFileSync(file, 'utf8');
        const lines = text.split('\n');
        let inEvents = false;
        let current: string | null = null;

        for (const line of lines) {
            if (/^events:\s*$/.test(line)) {
                inEvents = true;
                continue;
            }
            if (!inEvents) continue;
            // Верхнеуровневый ключ вне events закрывает секцию.
            if (/^\S/.test(line) && line.trim() !== '') break;

            const eventMatch = /^ {2}([a-z0-9_]+):\s*$/.exec(line);
            if (eventMatch) {
                current = eventMatch[1];
                map.set(current, { product: 'unknown' });
                continue;
            }
            const productMatch = /^ {4}product:\s*(.+?)\s*$/.exec(line);
            if (productMatch && current) {
                const value = productMatch[1];
                // Список в одну строку — [practice, zapiski, moments]
                // (E1) — иначе одно простое значение.
                const product = value.startsWith('[') && value.endsWith(']')
                    ? value.slice(1, -1).split(',').map((s) => s.trim()).filter(Boolean).join(', ')
                    : value;
                map.set(current, { product });
            }
        }
    } catch (error) {
        console.error('[panel] реестр событий не прочитан:', error);
    }

    cache = map;
    return map;
}

/** Только для тестов: сбросить разобранный реестр. */
export function resetRegistryCache(): void {
    cache = null;
}
