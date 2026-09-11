import { suggestAddresses, type SuggestOutcome } from '@/lib/dadata/suggest';
import { logSafeFailure } from '@/lib/observability/log';

/**
 * Один ответ подсказок на веб и приложение.
 *
 * Маршрутов два — они отличаются только тем, КТО спрашивает: веб-сессия или
 * ключ приложения. Всё остальное (что считается годным запросом, как
 * называется отказ, что попадает в журнал) обязано совпадать: разойдясь,
 * два разбора разойдутся молча, и подсказки сломаются в одном месте при
 * работающем другом.
 *
 * Контракт ответа называет причину, а не прячет её за пустым списком:
 *
 *   200 { suggestions }                  → нашли (в том числе ноль результатов)
 *   400 { error: 'INVALID_QUERY' }       → запрос не годится
 *   429 { error: 'RATE_LIMITED' }        → слишком часто
 *   502 { error: 'PROVIDER_UNAVAILABLE' } → DaData ответила ошибкой
 *   503 { error: 'NOT_CONFIGURED' }      → ключ не настроен в этом окружении
 *   504 { error: 'PROVIDER_UNAVAILABLE' } → DaData не уложилась в таймаут
 *
 * В журнал попадают только отказы САМОЙ интеграции и только полями: имя
 * провайдера и категория. Ни запроса, ни адреса, ни ответа DaData: запрос —
 * это то, что человек набрал в поле адреса, а туда он может набрать что
 * угодно, вплоть до адреса клиента.
 */
const FAILURE_LOG_CODE: Partial<Record<SuggestOutcome['reason'], string>> = {
    no_token: 'NO_TOKEN',
    upstream_error: 'UPSTREAM_ERROR',
    timeout: 'TIMEOUT',
};

const FAILURE_RESPONSE: Record<Exclude<SuggestOutcome['reason'], 'ok' | 'cached'>, { status: number; error: string }> = {
    invalid_query: { status: 400, error: 'INVALID_QUERY' },
    rate_limited: { status: 429, error: 'RATE_LIMITED' },
    no_token: { status: 503, error: 'NOT_CONFIGURED' },
    upstream_error: { status: 502, error: 'PROVIDER_UNAVAILABLE' },
    timeout: { status: 504, error: 'PROVIDER_UNAVAILABLE' },
};

export type SuggestReply = {
    status: number;
    body: { suggestions: unknown[] } | { error: string };
};

/** Частота считается по человеку, а не по устройству: счёт один. */
export async function suggestForUser(userId: string, query: unknown): Promise<SuggestReply> {
    const outcome = await suggestAddresses({ userId, query, token: process.env.DADATA_API_KEY });

    if (outcome.reason === 'ok' || outcome.reason === 'cached') {
        return { status: 200, body: { suggestions: outcome.suggestions } };
    }

    const logCode = FAILURE_LOG_CODE[outcome.reason];
    if (logCode) logSafeFailure('dadata', { provider: 'dadata', error_code: logCode });

    const failure = FAILURE_RESPONSE[outcome.reason];
    return { status: failure.status, body: { error: failure.error } };
}
