// Время ответа приложения (q_tech_response_p95, ТЗ §5). Самое дешёвое, что
// даёт честное число без внешнего APM: middleware.ts измеряет длительность
// каждого запроса (после того, как ответ фактически ушёл — через after() из
// 'next/server') и складывает миллисекунды в этот модуль; периодическая
// cron-задача (src/instrumentation.ts) раз в ~5 минут снимает окно,
// перцентилирует и пишет одну строку в AppResponseTime. Инфраструктура
// пишет сама — не infra-pulse-collector, у которого нет доступа к
// внутренним замерам процесса приложения; коллектор только читает
// последнюю строку (readResponseP95 ниже), как он уже читает DeployLog и
// Payment.

import type { PrismaClient } from '@prisma/client';

/** Общий буфер длительностей запросов текущего процесса (миллисекунды). */
export const defaultDurationStore: number[] = [];

const MAX_SAMPLES = 5000;

/** Добавляет одну длительность в буфер; отрицательные/нечисловые значения молча отбрасываются. */
export function recordRequestDuration(ms: number, store: number[] = defaultDurationStore, maxSamples = MAX_SAMPLES): void {
    if (!Number.isFinite(ms) || ms < 0) return;
    store.push(ms);
    if (store.length > maxSamples) {
        // Буфер ограничен — не даём одному аномально длинному окну
        // (например, если cron не смог сбросить его вовремя) съесть память.
        // Отбрасываем самые старые замеры, оставляем самые свежие.
        store.splice(0, store.length - maxSamples);
    }
}

/**
 * Ближайший ранг (nearest-rank) — общепринятый и самый дешёвый метод
 * перцентиля, не требует интерполяции. p — от 0 до 100.
 */
export function percentile(values: readonly number[], p: number): number | null {
    if (values.length === 0) return null;
    const sorted = [...values].sort((a, b) => a - b);
    const rank = Math.ceil((p / 100) * sorted.length);
    const idx = Math.min(sorted.length - 1, Math.max(0, rank - 1));
    return sorted[idx];
}

export interface ResponseTimeSummary {
    sampleCount: number;
    p50Ms: number | null;
    p95Ms: number | null;
    p99Ms: number | null;
}

export function summarizeDurations(store: readonly number[]): ResponseTimeSummary | null {
    if (store.length === 0) return null;
    return {
        sampleCount: store.length,
        p50Ms: percentile(store, 50),
        p95Ms: percentile(store, 95),
        p99Ms: percentile(store, 99),
    };
}

/** Снимает окно и опустошает буфер — следующее окно начинается с нуля. */
export function flushDurations(store: number[] = defaultDurationStore): ResponseTimeSummary | null {
    const summary = summarizeDurations(store);
    store.length = 0;
    return summary;
}

type WriteDb = Pick<PrismaClient, 'appResponseTime'>;

/**
 * Снимает окно и, если за него были запросы, пишет одну строку в
 * AppResponseTime. Пустое окно (сайт не получал запросов — редкость, но
 * не ошибка) ничего не пишет и это не считается сбоем.
 */
export async function persistResponseTimeWindow(
    db: WriteDb,
    windowStart: Date,
    windowEnd: Date,
    store: number[] = defaultDurationStore,
): Promise<boolean> {
    const summary = flushDurations(store);
    if (!summary) return false;
    await db.appResponseTime.create({
        data: {
            windowStart,
            windowEnd,
            sampleCount: summary.sampleCount,
            p50Ms: summary.p50Ms,
            p95Ms: summary.p95Ms,
            p99Ms: summary.p99Ms,
        },
    });
    return true;
}

type ReadDb = Pick<PrismaClient, 'appResponseTime'>;

/** Показание старее этого срока для коллектора — как будто его не было (не выдумываем свежести). */
export const RESPONSE_TIME_STALE_MINUTES = 30;

/** Последний известный p95, если он не устарел. Читает — не считает заново. */
export async function readResponseP95(
    db: ReadDb,
    now: Date = new Date(),
    staleAfterMinutes: number = RESPONSE_TIME_STALE_MINUTES,
): Promise<number | null> {
    const row = await db.appResponseTime.findFirst({ orderBy: { windowEnd: 'desc' } });
    if (!row || row.p95Ms === null || row.p95Ms === undefined) return null;
    const ageMinutes = (now.getTime() - row.windowEnd.getTime()) / 60000;
    if (ageMinutes > staleAfterMinutes) return null;
    return row.p95Ms;
}
