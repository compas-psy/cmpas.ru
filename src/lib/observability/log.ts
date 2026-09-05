/**
 * Безопасный структурный лог для отказов внешних поставщиков и конфликтов
 * записи (Задача 25 §6, §10, §11).
 *
 * Зачем отдельная функция, а не console.error со строкой. Обычный лог вида
 * `Auto-sync failed for google: ${error}` кажется безобидным, пока в
 * `error` не окажется ответ провайдера с названием встречи, а в нём — имя
 * клиента. Логи живут дольше и читаются шире, чем база: попавшее туда имя
 * человека убрать уже нельзя.
 *
 * Поэтому лог собирается не из текста, а из полей, и каждое поле проходит
 * проверку: только машинные значения — латиница, цифры, дефис, точка,
 * двоеточие, подчёркивание. Всё остальное (пробелы, кириллица, кавычки,
 * перевод строки) означает, что кто-то передал человеческий текст, и такое
 * значение в лог не попадает — вместо него встаёт `unsafe_value`. Это не
 * вежливая просьба, а свойство самой функции.
 *
 * error_code — стабильная машинная категория, а не сообщение исключения:
 * по нему можно считать, а по тексту нельзя.
 */

/** Машинное значение: то, что можно писать в лог, не рискуя утечкой. */
const SAFE_VALUE = /^[A-Za-z0-9_.:-]{1,64}$/;

export type SafeLogFields = {
    /** Внешняя система, о которой речь: google, yandex, dadata. */
    provider?: string;
    /** Стабильная машинная категория отказа. */
    error_code: string;
    /** Ниточка для поддержки — uuid запроса или операции, но не человека. */
    correlation_id?: string;
    /** Откуда пришёл запрос: public_booking, reschedule и т.п. */
    source?: string;
};

function safe(value: string | undefined): string | null {
    if (value === undefined) return null;
    return SAFE_VALUE.test(value) ? value : 'unsafe_value';
}

/**
 * Пишет одну строку вида `[scope] provider=google error_code=SYNC_FAILED`.
 *
 * Никогда не бросает: наблюдаемость не имеет права ронять то, за чем
 * наблюдает (Задача 25 §12).
 */
export function logSafeFailure(scope: string, fields: SafeLogFields): void {
    try {
        const parts: string[] = [];
        for (const key of ['provider', 'error_code', 'correlation_id', 'source'] as const) {
            const value = safe(fields[key]);
            if (value !== null) parts.push(`${key}=${value}`);
        }
        console.error(`[${safe(scope) ?? 'unknown'}] ${parts.join(' ')}`);
    } catch {
        /* лог не может быть причиной падения */
    }
}

/**
 * Категория отказа внешнего поставщика по исключению.
 *
 * Само исключение наружу не выходит — из него берётся только вид: истекло
 * ожидание, сеть не дошла, всё остальное. Текст, стек и тело ответа
 * провайдера остаются там, где они есть.
 */
export function providerErrorCode(error: unknown): 'PROVIDER_TIMEOUT' | 'PROVIDER_UNREACHABLE' | 'PROVIDER_ERROR' {
    const name = error instanceof Error ? error.name : '';
    if (name === 'AbortError' || name === 'TimeoutError') return 'PROVIDER_TIMEOUT';
    if (name === 'TypeError' || name === 'FetchError') return 'PROVIDER_UNREACHABLE';
    return 'PROVIDER_ERROR';
}
