// Периодический сброс окна времени ответа (q_tech_response_p95, ТЗ §5).
// src/proxy.ts копит длительности запросов в общем буфере процесса
// (src/lib/infra-pulse/response-time.ts, defaultDurationStore); эта функция
// раз в ~5 минут (см. src/instrumentation.ts) снимает окно, перцентилирует
// и пишет одну строку в AppResponseTime — если окно вообще не было пустым.
import { db } from '@/lib/db';
import { persistResponseTimeWindow } from '@/lib/infra-pulse/response-time';

let windowStart = new Date();

/**
 * Следующее окно начинается с `now` независимо от того, удалась ли запись —
 * иначе один сбой БД растянет окно на неопределённое время вперёд и исказит
 * будущий p95 куда сильнее, чем просто потерянное показание за один тик.
 */
export async function flushResponseTimeWindow(now: Date = new Date()): Promise<void> {
    const windowEnd = now;
    try {
        await persistResponseTimeWindow(db, windowStart, windowEnd);
    } catch (error) {
        console.error('[CRON] Ошибка записи окна времени ответа:', error);
    } finally {
        windowStart = windowEnd;
    }
}
