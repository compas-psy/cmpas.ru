import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { isIngestEnabled } from '@/lib/analytics/flags';
import { processIngestEvent, MAX_INGEST_BATCH_SIZE, type IngestResult } from '@/lib/analytics/ingest';
import { resolveIngestIdentity } from '@/lib/analytics/secrets';

/**
 * Подлинность запроса — до разбора тела: неаутентифицированный запрос не должен
 * управлять разбором. Раньше секрет был один на весь контур; теперь их
 * несколько, и каждый знает свой список продуктов (src/lib/analytics/secrets.ts).
 * Отсутствие настроенных секретов означает отказ всем, а не открытый приёмник.
 */

export async function POST(request: NextRequest) {
    if (!isIngestEnabled()) {
        return new NextResponse('Not Found', { status: 404 });
    }

    const identity = resolveIngestIdentity(request.headers.get('authorization'));
    if (!identity) {
        return NextResponse.json({ accepted: false, reason: 'unauthorized' }, { status: 401 });
    }
    const productAllowed = (product: string) => identity.allows(product);

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
        return NextResponse.json({ accepted: false, reason: 'invalid JSON body' }, { status: 400 });
    }

    // Пачка (O-260817-17): тело может быть одним событием (как раньше — не
    // ломаем существующее поведение и форму ответа) или массивом до
    // MAX_INGEST_BATCH_SIZE событий. Больше — честный отказ до того, как
    // обработано хоть одно событие, а не частичная обработка первых 200.
    if (Array.isArray(body)) {
        if (body.length === 0) {
            return NextResponse.json({ accepted: false, reason: 'empty batch' }, { status: 400 });
        }
        if (body.length > MAX_INGEST_BATCH_SIZE) {
            return NextResponse.json(
                { accepted: false, reason: `batch too large: max ${MAX_INGEST_BATCH_SIZE} events, got ${body.length}` },
                { status: 400 },
            );
        }
        const results: IngestResult[] = [];
        for (const item of body) {
            results.push(await processIngestEvent(db, item, new Date(), undefined, productAllowed));
        }
        return NextResponse.json({ results });
    }

    const result = await processIngestEvent(db, body, new Date(), undefined, productAllowed);
    return NextResponse.json(result);
}
