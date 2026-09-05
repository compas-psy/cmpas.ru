import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { suggestAddresses, type SuggestOutcome } from '@/lib/dadata/suggest';

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
 */
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

    const failure = FAILURE_RESPONSE[outcome.reason];
    return NextResponse.json({ error: failure.error }, { status: failure.status });
}
