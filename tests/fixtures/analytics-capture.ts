// Задача 25: общая ловушка событий для тестов наблюдаемости.
//
// Тесты перехватывают track() — самый нижний слой, через который уходят все
// десять событий, — и потом ПРОГОНЯЮТ каждое перехваченное событие через
// настоящий реестр. Одного перехвата мало: он показал бы, что событие
// отправлено, но не то, что оно вообще имеет право существовать с такими
// props. Реестр — это и есть запрет на PII, и проверять надо им.

import { expect } from 'vitest';
import { loadRegistry, validateEvent } from '@/lib/analytics/schema';

export type CapturedEvent = {
    event: string;
    product: string;
    accountId?: string | null;
    deviceId?: string | null;
    props: Record<string, unknown>;
};

/**
 * Слова, которых в имени prop события ПРАКТИКИ быть не может.
 *
 * Сверка идёт по СЛОВАМ (prop режется по подчёркиванию), а не по подстроке:
 * иначе «id» запретил бы provider, а «note» — ничего не значащий notes_count.
 * Отдельно ловятся слипшиеся написания вроде clientId.
 */
export const FORBIDDEN_PROP_WORDS = [
    'name', 'email', 'phone', 'client', 'session', 'notes', 'note', 'summary',
    'title', 'address', 'token', 'url', 'link', 'message', 'text', 'details',
    'detail', 'stack', 'file', 'query', 'id',
];

/** Слипшиеся написания: clientid, sessionid, filename и подобное. */
export const FORBIDDEN_PROP_SUBSTRINGS = ['clientid', 'sessionid', 'filename', 'errormessage', 'error_message'];

/** Нарушение или null. Числовые счётчики (*_count) проверяются отдельно. */
export function forbiddenPropWord(prop: string): string | null {
    const glued = prop.toLowerCase().replace(/_/g, '');
    for (const bad of FORBIDDEN_PROP_SUBSTRINGS) {
        if (glued.includes(bad.replace(/_/g, ''))) return bad;
    }
    const words = prop.toLowerCase().split('_');
    for (const word of words) {
        if (FORBIDDEN_PROP_WORDS.includes(word)) return word;
    }
    return null;
}

/** Каждое событие обязано проходить настоящую валидацию по events.yaml. */
export function expectRegistryClean(events: CapturedEvent[]): void {
    const registry = loadRegistry();
    for (const captured of events) {
        const result = validateEvent({
            event: captured.event,
            ts: new Date().toISOString(),
            product: captured.product,
            account_id: captured.accountId ?? null,
            device_id: captured.deviceId ?? null,
            props: captured.props ?? {},
            schema_version: 1,
        }, registry);
        expect(result, `${captured.event}: ${JSON.stringify(captured.props)}`).toEqual({ valid: true });
    }
}

/** Значения props — только числа и машинные строки, без человеческого текста. */
export function expectNoHumanText(events: CapturedEvent[]): void {
    for (const captured of events) {
        for (const [key, value] of Object.entries(captured.props ?? {})) {
            if (typeof value === 'number' || typeof value === 'boolean') continue;
            expect(typeof value, `${captured.event}.${key}`).toBe('string');
            expect(String(value), `${captured.event}.${key}`).toMatch(/^[a-z_]+$/i);
        }
    }
}

export function eventsNamed(events: CapturedEvent[], name: string): CapturedEvent[] {
    return events.filter((e) => e.event === name);
}
