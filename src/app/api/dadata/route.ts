import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { suggestAddresses, type SuggestOutcome } from '@/lib/dadata/suggest';
import { logSafeFailure } from '@/lib/observability/log';

/**
 * Прокси подсказок адресов DaData. Токен остаётся на сервере, но этого мало:
 * подсказки платные и считаются по запросам, поэтому эндпоинт закрыт
 * авторизацией и ограничен по частоте — иначе это открытый счёт, который
 * может тратить кто угодно (Задача 19).
 *
 * Контракт ответа называет причину, а не прячет её за пустым списком:
 *
 *   200 { suggestions }                → нашли (в том числе ноль результатов)
 *   400 { error: 'INVALID_QUERY' }     → запрос не годится
 *   429 { error: 'RATE_LIMITED' }      → слишком часто, подсказки временно молчат
 *   502 { error: 'PROVIDER_UNAVAILABLE' } → DaData ответила ошибкой или не ответила
 *   503 { error: 'NOT_CONFIGURED' }    → ключ не настроен в этом окружении
 *   504 { error: 'PROVIDER_UNAVAILABLE' } → DaData не уложилась в таймаут
 *
 * Пустой список при 200 и недоступность провайдера — РАЗНЫЕ вещи. Раньше
 * любая поломка выглядела как «ничего не нашлось»: интеграция могла молча
 * не работать месяцами, и ни специалист, ни мы бы об этом не узнали.
 *
 * Задача 25 §10: код ответа честен для того, кто спрашивает, но ничего не
 * говорит нам. Поэтому три отказа самой интеграции — нет ключа, провайдер
 * ответил ошибкой, провайдер не уложился в таймаут — пишутся в лог полями,
 * а не строкой. В логе оказывается только имя провайдера и категория отказа:
 * ни запроса, ни адреса, ни тела ответа DaData, ни токена. Запрос — это то,
 * что человек набирает в поле адреса кабинета, и туда он может набрать что
 * угодно, вплоть до адреса клиента.
 *
 * invalid_query и rate_limited сюда не попадают намеренно: это поведение
 * вызывающего, а не поломка интеграции, и в логе они были бы шумом.
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

export async function POST(req: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Кривое тело — это тоже негодный запрос, а не 500 со стеком.
    const body = await req.json().catch(() => null);

    const outcome = await suggestAddresses({
        userId: session.user.id,
        query: (body as { query?: unknown } | null)?.query,
        token: process.env.DADATA_API_KEY,
    });

    if (outcome.reason === 'ok' || outcome.reason === 'cached') {
        return NextResponse.json({ suggestions: outcome.suggestions });
    }

    const logCode = FAILURE_LOG_CODE[outcome.reason];
    if (logCode) logSafeFailure('dadata', { provider: 'dadata', error_code: logCode });

    const failure = FAILURE_RESPONSE[outcome.reason];
    return NextResponse.json({ error: failure.error }, { status: failure.status });
}
