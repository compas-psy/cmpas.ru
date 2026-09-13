/**
 * ДОСЫЛКА НАКОПЛЕННОГО ПРИ ПРИВЯЗКЕ МЕССЕНДЖЕРА.
 *
 * ЖИВОЙ СЛУЧАЙ, 13.09.2026. Учредитель привязал клиенту MAX — и человеку
 * тут же пришло «Подтверждаю запись на консультацию … 26 февраля 2026 г. в
 * 17:15». Февраль был семь месяцев назад. Клиент, только что подключивший
 * уведомления, первым делом получил подтверждение встречи, которая давно
 * прошла.
 *
 * Причина: сообщение, которое некуда было доставить (мессенджера у клиента
 * ещё не было), кладётся в очередь со СРОКОМ ЖИЗНИ ПРИГЛАШЕНИЯ — тридцать
 * дней. А слив очереди при привязке брал ВСЁ, что лежит в `pending`, без
 * единого условия: ни на возраст, ни на то, не прошла ли названная в нём
 * встреча.
 *
 * Тот же слив был скопирован в ШЕСТЬ мест (два вебхука, два бота, маршрут
 * входа через Telegram, крон) — и ошибка, естественно, была во всех шести.
 * Поэтому здесь одна функция, а не седьмая копия.
 *
 * ПРАВИЛО ОДНО: досылается то, что ещё ПРАВДА.
 *
 *   * сообщение о встрече правда, пока встреча не прошла и не отменена;
 *   * сообщение без встречи (приглашение, инструкция по оплате) правда,
 *     пока живо само приглашение — тридцать дней.
 *
 * Протухшее не удаляется молча, а получает терминальный статус с причиной:
 * иначе оно всплыло бы при следующей привязке, а в отчётах выглядело бы
 * как «доставлено».
 */

import { db } from '@/lib/db';
import { isSessionFuture } from '@/lib/session-maintenance';

/** Сколько живёт сообщение, не привязанное к встрече. Столько же, сколько приглашение. */
export const QUEUED_MESSAGE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export type QueuedSkipReason =
    /** Встреча, о которой сообщение, уже прошла. */
    | 'SESSION_PASSED'
    /** Встречу отменили, пока сообщение лежало в очереди. */
    | 'SESSION_CANCELLED'
    /** Встречи больше нет вовсе. */
    | 'SESSION_GONE'
    /** Приглашение протухло, а с ним и текст. */
    | 'QUEUED_TOO_LONG';

export interface QueuedMessage {
    id: string;
    text: string;
    sessionId: string | null;
    createdAt: Date;
}

/**
 * Стоит ли ещё досылать это сообщение.
 *
 * Отдельной функцией, потому что то же решение принимает крон: у него свой
 * цикл, но правило обязано быть одно.
 */
export async function queuedMessageSkipReason(
    message: Pick<QueuedMessage, 'sessionId' | 'createdAt'>,
    now: Date = new Date(),
): Promise<QueuedSkipReason | null> {
    if (message.sessionId) {
        const session = await db.diarySession.findUnique({
            where: { id: message.sessionId },
            select: { date: true, time: true, status: true },
        });
        if (!session) return 'SESSION_GONE';
        if (session.status === 'cancelled') return 'SESSION_CANCELLED';
        if (!isSessionFuture(session, now)) return 'SESSION_PASSED';
        return null;
    }

    return now.getTime() - message.createdAt.getTime() > QUEUED_MESSAGE_TTL_MS
        ? 'QUEUED_TOO_LONG'
        : null;
}

export interface FlushResult {
    sent: number;
    skipped: number;
    failed: number;
}

/**
 * Досылка накопленного одному клиенту в один канал.
 *
 * @param send отправка одного текста. Бросила — сообщение помечается
 *             `failed` с её причиной, остальные всё равно пробуются: одно
 *             упавшее не должно задерживать очередь целиком.
 */
export async function flushQueuedMessages(params: {
    clientId: string;
    channel: 'telegram' | 'max';
    send: (text: string) => Promise<void>;
    now?: Date;
}): Promise<FlushResult> {
    const now = params.now ?? new Date();
    const result: FlushResult = { sent: 0, skipped: 0, failed: 0 };

    const queued = await db.scheduledClientMessage.findMany({
        where: { clientId: params.clientId, channel: params.channel, status: 'pending' },
        orderBy: { createdAt: 'asc' },
    });

    for (const message of queued) {
        const skip = await queuedMessageSkipReason(message, now);
        if (skip) {
            await db.scheduledClientMessage.update({
                where: { id: message.id },
                data: { status: 'failed', errorMsg: skip },
            });
            result.skipped += 1;
            // В журнал — только причина и канал: ни имени, ни текста.
            console.log(`[queued] ${skip} ${params.channel}`);
            continue;
        }

        try {
            await params.send(message.text);
            await db.scheduledClientMessage.update({
                where: { id: message.id },
                data: { status: 'sent', sentAt: now },
            });
            result.sent += 1;
        } catch (error) {
            await db.scheduledClientMessage.update({
                where: { id: message.id },
                data: { status: 'failed', errorMsg: error instanceof Error ? error.message : 'send failed' },
            });
            result.failed += 1;
        }
    }

    return result;
}
