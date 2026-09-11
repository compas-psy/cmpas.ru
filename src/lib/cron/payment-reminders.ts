import { randomUUID } from 'crypto';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { db } from '@/lib/db';
import { deliverMessage, deliverPhoto } from '@/lib/messaging/deliver';
import { isQuietHour } from '@/lib/messaging/quiet-hours';
import { paymentQrSource, paymentQrPng, PAYMENT_QR_CAPTION } from '@/lib/messaging/payment-qr';
import { paymentInstructionText } from '@/lib/messaging/payment-instruction';
import { clampReminderHours } from '@/lib/messaging/payment-reminder-interval';
import { track } from '@/lib/analytics/track';

/**
 * НАПОМИНАНИЕ ОБ ОПЛАТЕ ПЕРЕД ВСТРЕЧЕЙ.
 *
 * Решение учредителя 11.09.2026, дословно: «отправлять перед первой или
 * последующими сессиями ссылку на оплату нужно. Интервал за сколько до
 * сессии отправлять выбирает психолог».
 *
 * ЧЕГО ЭТО НЕ ДЕЛАЕТ. ПРАКТИКА не связана с банками специалиста и не знает,
 * заплатил ли клиент: «у нас нет связи с их банками… мы не сможем
 * самостоятельно проставить статус оплаты — только сам психолог». Поэтому
 * здесь нет ни проверки поступления, ни повторов «вы не оплатили»: уходит
 * ОДНО напоминание на встречу, с той же инструкцией и тем же кодом, что и
 * при заведении клиента. Отметку об оплате ставит специалист руками, и
 * встреча, уже отмеченная оплаченной, напоминания не получает.
 *
 * ПОЧЕМУ НЕ РЯДОМ С processReminders. Те напоминания — о самой встрече, у
 * них свои поля notified24h/notified1h на сессии и свой журнал
 * ReminderOutbox. Это — про деньги, включается отдельно и по умолчанию
 * выключено: включать за специалиста рассылку с платёжной ссылкой его
 * клиентам нельзя.
 */

type ReminderSettings = {
    psychologistId: string;
    paymentText: string | null;
    paymentLink: string | null;
    paymentQrUrl: string | null;
    prepaymentRequired: boolean;
    paymentDueText: string | null;
    paymentReminderHoursBefore: number;
    timezone: string | null;
};

/**
 * Текст напоминания.
 *
 * Первая строка называет встречу: человек получает ссылку на оплату не «за
 * консультации вообще», а за конкретный час конкретного дня — иначе он не
 * понимает, за что платит, и платит дважды либо не платит вовсе.
 *
 * Дальше — та же инструкция, что он уже видел при записи
 * (paymentInstructionText): два разных текста об одной оплате от одного
 * специалиста выглядят как ошибка.
 */
export function buildPaymentReminderText(params: {
    clientName: string;
    date: Date;
    time: string;
    timezoneLabel?: string | null;
    instruction: string;
}): string {
    const when = format(params.date, 'd MMMM', { locale: ru });
    const zone = params.timezoneLabel ? ` (${params.timezoneLabel})` : '';
    return [
        `${params.clientName}, напоминаю об оплате встречи ${when} в ${params.time}${zone}.`,
        '',
        params.instruction,
    ].join('\n');
}

async function readReminderSettings(): Promise<ReminderSettings[]> {
    // Пояс практики приезжает тем же запросом: он нужен и для тихих часов, и
    // для подписи времени. Отдельный запрос на каждого специалиста в цикле
    // был бы вторым обращением в базу ради одного поля.
    return db.$queryRaw<ReminderSettings[]>`
        SELECT p."psychologistId", p."paymentText", p."paymentLink", p."paymentQrUrl",
               p."prepaymentRequired", p."paymentDueText", p."paymentReminderHoursBefore",
               s.timezone
        FROM "PsychologistPaymentSettings" p
        LEFT JOIN "PsychologistSettings" s ON s."psychologistId" = p."psychologistId"
        WHERE p."isEnabled" = true AND p."paymentReminderEnabled" = true
    `;
}

/** По этой встрече уже уходило напоминание — или специалист отметил оплату. */
async function alreadyHandled(sessionId: string): Promise<boolean> {
    const rows = await db.$queryRaw<Array<{ count: number }>>`
        SELECT COUNT(*)::int as count
        FROM "SessionPaymentRequest"
        WHERE "sessionId" = ${sessionId}
          AND (kind = 'reminder' OR "markedPaidAt" IS NOT NULL)
    `;
    return (rows[0]?.count ?? 0) > 0;
}

async function recordReminder(params: { sessionId: string; settings: ReminderSettings; clientId: string }) {
    const { sessionId, settings, clientId } = params;
    const now = new Date();
    await db.$executeRaw`
        INSERT INTO "SessionPaymentRequest"
            (id, "sessionId", "psychologistId", "clientId", status, kind, "paymentTextSnapshot", "paymentLinkSnapshot", "paymentQrUrlSnapshot", "sentAt", "createdAt", "updatedAt")
        VALUES
            (${randomUUID()}, ${sessionId}, ${settings.psychologistId}, ${clientId}, 'sent', 'reminder', ${settings.paymentText}, ${settings.paymentLink}, ${settings.paymentQrUrl}, ${now}, ${now}, ${now})
    `;
}

export async function processPaymentReminders(now: Date = new Date()) {
    try {
        const settings = await readReminderSettings();
        if (settings.length === 0) return;

        for (const setting of settings) {
            const hours = clampReminderHours(setting.paymentReminderHoursBefore);

            // ТИШИНА СИЛЬНЕЕ ИНТЕРВАЛА. Напоминание об оплате в час ночи —
            // это то, за что специалисту стыдно перед его клиентом, а не
            // перед нами. Пропущенный из-за тишины проход не теряется:
            // отметка не ставится, и первый же дневной проход отправит —
            // если встреча ещё не началась.
            if (isQuietHour(setting.timezone, now)) continue;

            const due = new Date(now.getTime() + hours * 60 * 60 * 1000);
            const sessions = await db.diarySession.findMany({
                where: {
                    psychologistId: setting.psychologistId,
                    status: { in: ['pending', 'confirmed'] },
                    clientNotificationsEnabled: true,
                    date: { gt: now, lte: due },
                } as any,
                include: { client: true },
            });

            for (const rawSession of sessions) {
                const session = rawSession as any;
                const client = session.client;
                if (!client) continue;
                if (!client.telegramChatId && !client.maxChatId) continue;
                if (await alreadyHandled(session.id)) continue;

                const instruction = paymentInstructionText(setting);
                const text = buildPaymentReminderText({
                    clientName: client.name,
                    date: session.date,
                    time: session.time,
                    instruction,
                });

                const delivered = await deliverMessage(client, text);
                if (!delivered.sent) continue;

                // Отметка — только после удавшейся отправки: неудача должна
                // повториться следующим проходом, а не молча превратиться в
                // «напоминание было».
                await recordReminder({ sessionId: session.id, settings: setting, clientId: client.id });

                // Код оплаты — той же картинкой и в тот же канал, что и при
                // заведении клиента. Не нарисовался или не дошёл — ссылка
                // ушла текстом выше, и это не повод считать напоминание
                // несостоявшимся.
                const source = paymentQrSource(setting);
                if (source) {
                    const png = await paymentQrPng(source).catch(() => null);
                    if (png) await deliverPhoto(client, png, PAYMENT_QR_CAPTION);
                }

                // Без ПД: только факт и выбранный интервал. Ни имени, ни
                // суммы, ни ссылки — поступления денег ПРАКТИКА не видит и
                // видеть не должна.
                await track(db, {
                    event: 'payment_reminder_sent',
                    product: 'practice',
                    accountId: setting.psychologistId,
                    props: { hours_before: hours },
                });
            }
        }
    } catch (error) {
        console.error('[processPaymentReminders] Ошибка вызова CRON:', error);
    }
}
