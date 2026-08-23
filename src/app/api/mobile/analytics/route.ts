import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateMobileRequest, unauthorizedResponse } from '@/lib/mobile-auth';
import { processIngestEvent, MAX_INGEST_BATCH_SIZE, type IngestResult } from '@/lib/analytics/ingest';

/**
 * POST /api/mobile/analytics (решение учредителя 3): приложение шлёт сюда
 * обычным пользовательским JWT (authenticateMobileRequest), не секретом
 * приёмника — секрет в APK не кладём. Наружу этот запрос не выходит, так
 * что секрет здесь вовсе не нужен: сервер сам подставляет product:'practice'
 * и account_id = auth.userId, и вызывает processIngestEvent напрямую.
 *
 * Тело — массив конвертов БЕЗ account_id и БЕЗ секрета: клиент не может
 * подставить чужой account_id, потому что в теле для него нет места —
 * любое значение, которое клиент всё же пришлёт под этим ключом, здесь
 * игнорируется и переопределяется значением из токена.
 *
 * device_id приложение не отправляет вовсе (решение 4) — эта точка не
 * читает его из тела, даже если он там окажется, и всегда пишет null.
 *
 * Вторая линия защиты (fail-closed): сегодня ветка practice+account_id
 * приёмника (writeAccountEvent, src/lib/analytics/ingest.ts) пишет событие
 * даже без согласия — эту ветку в этой задаче намеренно не трогаем
 * (порядок учредителя: сначала точка согласия, потом замер доли событий
 * без согласия, потом ужесточение приёмника). Поэтому согласие проверяется
 * ЗДЕСЬ, до вызова processIngestEvent: без него ни один из событий пачки
 * не доходит до записи.
 *
 * consent_updated через эту точку не проходит: согласие — ресурс
 * (PUT /api/mobile/analytics/consent), а не событие, которое можно
 * протащить в общей пачке — иначе granted:false здесь снял бы согласие в
 * обход атомарного удаления событий, которое делает только та точка.
 */

const CONSENT_REQUIRED_REASON = 'consent required — grant via PUT /api/mobile/analytics/consent first';
const CONSENT_EVENT_BLOCKED_REASON = 'consent_updated must be submitted via PUT /api/mobile/analytics/consent, not this endpoint';

export async function POST(req: NextRequest) {
    const auth = await authenticateMobileRequest(req);
    if (!auth) return unauthorizedResponse();

    const body = await req.json().catch(() => null);
    if (!Array.isArray(body)) {
        return NextResponse.json({ accepted: false, reason: 'body must be an array of event envelopes' }, { status: 400 });
    }
    if (body.length === 0) {
        return NextResponse.json({ accepted: false, reason: 'empty batch' }, { status: 400 });
    }
    if (body.length > MAX_INGEST_BATCH_SIZE) {
        return NextResponse.json(
            { accepted: false, reason: `batch too large: max ${MAX_INGEST_BATCH_SIZE} events, got ${body.length}` },
            { status: 400 },
        );
    }

    const user = await db.user.findUnique({ where: { id: auth.userId }, select: { analyticsConsentAt: true } });
    const consentGiven = !!user?.analyticsConsentAt;

    const results: IngestResult[] = [];
    for (const item of body) {
        const raw = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;

        if (raw.event === 'consent_updated') {
            results.push({ accepted: false, reason: CONSENT_EVENT_BLOCKED_REASON });
            continue;
        }
        if (!consentGiven) {
            results.push({ accepted: false, reason: CONSENT_REQUIRED_REASON });
            continue;
        }

        const envelope = {
            event: raw.event,
            ts: raw.ts,
            product: 'practice',
            account_id: auth.userId,
            device_id: null,
            props: raw.props,
            schema_version: raw.schema_version,
            event_id: raw.event_id,
        };
        results.push(await processIngestEvent(db, envelope));
    }

    return NextResponse.json({ results });
}
