import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { isIngestEnabled } from '@/lib/analytics/flags';
import { processIngestEvent, MAX_INGEST_BATCH_SIZE, type IngestResult } from '@/lib/analytics/ingest';

/**
 * Общий секрет POST /ingest (O-260817-17). Раньше приёмник не проверял
 * подлинность запроса вовсе — за флагом ANALYTICS_INGEST_ENABLED, но открыт
 * кому угодно, кто узнает URL. Без секрета в окружении отказываем ВСЕМ
 * запросам, а не работаем открытым — в отличие от
 * TELEGRAM_WEBHOOK_SECRET (src/app/api/telegram/webhook/route.ts), который
 * намеренно fail-open, потому что скрипт выкладки его гарантированно
 * генерирует. Секрет ingest — отдельная ручная настройка, её отсутствие
 * с большей вероятностью забытая конфигурация, чем гарантированный факт
 * продакшена, поэтому здесь — fail-closed.
 */
function verifyIngestSecret(request: NextRequest): boolean {
    const expected = process.env.ANALYTICS_INGEST_SECRET;
    if (!expected) return false;

    const header = request.headers.get('authorization') ?? '';
    const prefix = 'Bearer ';
    if (!header.startsWith(prefix)) return false;

    const got = Buffer.from(header.slice(prefix.length));
    const want = Buffer.from(expected);
    return got.length === want.length && crypto.timingSafeEqual(got, want);
}

export async function POST(request: NextRequest) {
    if (!isIngestEnabled()) {
        return new NextResponse('Not Found', { status: 404 });
    }

    if (!verifyIngestSecret(request)) {
        return NextResponse.json({ accepted: false, reason: 'unauthorized' }, { status: 401 });
    }

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
            results.push(await processIngestEvent(db, item));
        }
        return NextResponse.json({ results });
    }

    const result = await processIngestEvent(db, body);
    return NextResponse.json(result);
}
