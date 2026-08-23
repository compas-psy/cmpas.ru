// Отправка событий ПРАКТИКИ в POST /ingest (задача B4, charter/13_TRACKING_PLAN.md
// §3-4, analytics/schema/events.yaml). Точки вызова — реальные места, где
// событие происходит: см. вызовы track() в src/app/api/payments/*,
// src/auth.ts.
//
// Конверт — тот же, что принимает POST /ingest: {event, ts, product,
// account_id, device_id, props, schema_version}. Вместо HTTP-запроса самого
// к себе (тот же процесс, тот же деплой — сетевой виток не нужен и
// добавляет точку отказа, которой нет смысла быть) события идут напрямую в
// processIngestEvent — ту же функцию, что использует сам route /ingest, с
// той же валидацией по реестру. "Транспорт" здесь — это сама эта функция:
// её ошибка (в т.ч. недоступность базы) ловится ниже и не долетает до
// вызывающего кода — падение аналитики не должно ронять платёж, вход или
// что угодно ещё в пользовательском пути.
//
// За ANALYTICS_TRACKING_ENABLED (не ANALYTICS_INGEST_ENABLED — тот гасит
// только HTTP-ручку /ingest, см. src/app/api/ingest/route.ts): это
// поведенческая аналитика в чистом виде, ровно то, для чего флаг заведён
// (см. src/lib/analytics/flags.ts и коммит B1, который специально убрал
// этот же флаг с записи Subscription — учётной записи о деньгах, не
// поведения).

import { isTrackingEnabled } from './flags';
import { processIngestEvent, type IngestResult } from './ingest';

type Db = Parameters<typeof processIngestEvent>[0];

export interface TrackInput {
    event: string;
    product: string;
    /** Хотя бы одно из accountId/deviceId обязано быть задано — тот же контракт, что у /ingest. */
    accountId?: string | null;
    deviceId?: string | null;
    props?: Record<string, unknown>;
}

/**
 * Пишет одно событие ПРАКТИКИ. Никогда не бросает: ошибка (флаг выключен,
 * упала валидация, недоступна база) логируется и проглатывается — вызвавший
 * код продолжает свой путь как ни в чём не бывало.
 */
export async function track(db: Db, input: TrackInput, now: Date = new Date()): Promise<void> {
    if (!isTrackingEnabled()) return;

    try {
        const result: IngestResult = await processIngestEvent(
            db,
            {
                event: input.event,
                ts: now.toISOString(),
                product: input.product,
                account_id: input.accountId ?? null,
                device_id: input.deviceId ?? null,
                props: input.props ?? {},
                schema_version: 1,
            },
            now,
        );
        if (!result.accepted) {
            console.error(`[analytics] track(${input.event}) отклонено: ${result.reason}`);
        }
    } catch (error) {
        console.error(`[analytics] track(${input.event}) упало:`, error);
    }
}
