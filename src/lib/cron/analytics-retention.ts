// Срок хранения AnalyticsEvent — 180 дней (решение учредителя 6: "Отзыв
// согласия УДАЛЯЕТ события этого человека. Общий срок хранения — 180
// дней."). До этой задачи ничто и никогда не удаляло строки AnalyticsEvent
// — эта cron-задача заводит политику хранения тем же способом, что и
// остальные периодические задачи (см. src/instrumentation.ts,
// src/lib/cron/response-time.ts).
import { db } from '@/lib/db';

/**
 * 180 дней — не произвольное число: самое длинное окно, которое читает
 * панель, — недельные когорты ретеншена `q_cohorts_practice`
 * (src/lib/panel/queries/retention.ts: 4 когорты × 6 недель наблюдения —
 * (4 + 6 − 1) недель ≈ 63 дня от самой старой когорты до сегодняшнего дня).
 * 180 даёт запас поверх этого окна на сезонность (например сравнение
 * месяца с тем же месяцем ранее), не подрезая ни одну витрину впритык к
 * границе хранения.
 */
export const ANALYTICS_RETENTION_DAYS = 180;

type Db = { analyticsEvent: { deleteMany: (args: { where: { ts: { lt: Date } } }) => Promise<{ count: number }> } };

/**
 * Удаляет строки AnalyticsEvent, чьё событийное время (`ts`, не `createdAt`
 * записи о загрузке) старше ANALYTICS_RETENTION_DAYS дней от `now`.
 * Используется и периодической задачей ниже (все продукты сразу), и не
 * заменяет собой немедленное удаление по отзыву согласия
 * (PUT /api/mobile/analytics/consent) — та удаляет события конкретного
 * человека сразу, эта чистит по возрасту раз в сутки для всех.
 */
export async function pruneOldAnalyticsEvents(database: Db = db, now: Date = new Date()): Promise<number> {
    const cutoff = new Date(now.getTime() - ANALYTICS_RETENTION_DAYS * 24 * 60 * 60 * 1000);
    const { count } = await database.analyticsEvent.deleteMany({ where: { ts: { lt: cutoff } } });
    return count;
}
