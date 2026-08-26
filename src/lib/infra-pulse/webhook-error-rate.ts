// Доля ошибок «вебхуков» (InfraPulse.webhookErrorRates, карточка «Каналы»).
//
// Упрощение, зафиксированное здесь намеренно, а не по недосмотру:
// TZ_admin_panel_dev.md §5.1 изначально задумывал долю ошибок конкретно
// Telegram- и MAX-ботов. Но фактическая доставка их сообщений нигде не
// журналируется в базу — sendTelegramMessage/sendMaxMessage
// (src/lib/telegram.ts, src/lib/max-bot.ts) на неудаче пишут в консоль и не
// возвращают статус наружу вызывающему коду. Собирать эту долю значило бы
// либо выдумывать источник, которого нет, либо менять сигнатуры этих
// функций и десяток мест их вызова — за рамками задачи о коллекторе.
//
// Единственный по-настоящему вебхучный и при этом честно измеримый сигнал,
// который уже есть в базе, — приёмник платежей Т-Банка
// (src/app/api/payments/callback/route.ts): это тоже вебхук, и Payment.status
// после его обработки объективно известен. Берём долю платежей со статусом
// 'failed' — значения статусов буквально из схемы (prisma/schema.prisma,
// модель Payment: 'pending' | 'paid' | 'failed' | 'cancelled'), не выдуманы.
// Разбивка по конкретно Telegram/MAX, которую описывал TZ, остаётся будущей
// работой — здесь честный источник вместо придуманного.
//
// Окно — WINDOW_DAYS (30), а не сутки: было суточным, но при девяти платежах
// за всю историю проекта сутки почти всегда пусты, и панель («Техника», карточка
// «Каналы») гасла без единого платежа для расчёта в тот же момент, когда
// «Деньги» и «Утро» рядом уже показывали число по 30-дневному окну
// (src/lib/panel/queries/money.ts, PAYMENTS_WINDOW_DAYS) — тот же платёжный
// вопрос не может отвечать на два разных окна одновременно.

import type { PrismaClient } from '@prisma/client';

export interface WebhookErrorRateReading {
    rate: number; // 0..1
    checkedAt: string; // ISO
    sampleSize: number;
}

/** Чистый расчёт — без похода в базу, легко тестируется. */
export function computePaymentFailureRate(
    counts: { total: number; failed: number },
    now: Date,
): WebhookErrorRateReading | null {
    if (counts.total <= 0) return null; // нет платежей за сутки — это "нет данных", не "0% ошибок"
    return { rate: counts.failed / counts.total, checkedAt: now.toISOString(), sampleSize: counts.total };
}

type Db = Pick<PrismaClient, 'payment'>;

/** Согласовано с `PAYMENTS_WINDOW_DAYS` в `src/lib/panel/queries/money.ts` — тот же платёжный вопрос, то же окно. */
export const WEBHOOK_ERROR_RATE_WINDOW_DAYS = 30;

export async function readPaymentFailureRate(db: Db, now: Date = new Date()): Promise<WebhookErrorRateReading | null> {
    const since = new Date(now.getTime() - WEBHOOK_ERROR_RATE_WINDOW_DAYS * 24 * 60 * 60 * 1000);
    const [total, failed] = await Promise.all([
        db.payment.count({ where: { createdAt: { gte: since } } }),
        db.payment.count({ where: { createdAt: { gte: since }, status: 'failed' } }),
    ]);
    return computePaymentFailureRate({ total, failed }, now);
}
