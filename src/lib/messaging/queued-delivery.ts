/**
 * ДОСЫЛКА НАКОПЛЕННОГО ПРИ ПРИВЯЗКЕ МЕССЕНДЖЕРА.
 *
 * ЖИВОЙ СЛУЧАЙ, 13.09.2026. Учредитель привязал клиентке MAX — и человеку
 * тут же пришло «Подтверждаю запись на консультацию … 26 февраля 2026 г. в
 * 17:15». Эта встреча была семь месяцев назад.
 *
 * ГЛАВНОЕ ПРАВИЛО — ВРЕМЯ ВСТРЕЧИ, А НЕ ВОЗРАСТ СООБЩЕНИЯ. Подтверждение,
 * напоминание и перенос говорят о конкретном часе: как только этот час
 * наступил и прошёл, сообщение о нём перестаёт быть правдой, сколько бы ему
 * ни было дней. Свежее сообщение о вчерашней встрече так же бессмысленно,
 * как и месячной давности.
 *
 * Срок в тридцать дней — правило ВТОРОЕ и только для текстов, которые ни о
 * какой встрече не говорят (приглашение, инструкция по оплате): у них нет
 * часа, по которому судить, поэтому судим по сроку жизни приглашения.
 *
 * Слив очереди брал ВСЁ, что лежит в `pending`, без обеих проверок, и был
 * скопирован в ШЕСТЬ мест — ошибка, естественно, была во всех шести.
 * Поэтому здесь одна функция, а не седьмая копия.
 *
 * Отброшенное не удаляется молча, а получает терминальный статус с причиной:
 * иначе оно всплыло бы при следующей привязке, а в отчётах выглядело бы как
 * «доставлено».
 *
 * И ОТДЕЛЬНО — КАК ЭТО ЗВУЧИТ. Человек только что подключил уведомления;
 * вываливать ему следом три сообщения без единого слова — разговор тупого
 * бота. Поэтому перед накопленным идёт одна строка, объясняющая, откуда оно
 * взялось (`backlogIntro`), и идёт она только тогда, когда доставлять правда
 * есть что.
 */

import { db } from '@/lib/db';
import { isSessionFuture } from '@/lib/session-maintenance';

/** Сколько живёт сообщение, не привязанное к встрече. Столько же, сколько приглашение. */
export const QUEUED_MESSAGE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export type QueuedSkipReason =
    /** Час, о котором сообщение, уже наступил и прошёл. Главное правило. */
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

/**
 * Одна строка перед накопленным.
 *
 * Без неё человек, только что подключивший уведомления, получает подряд
 * несколько сообщений о разном и не понимает, почему они пришли все сразу и
 * почему именно сейчас. Строка отвечает ровно на это и ничего не обещает.
 *
 * Числительное согласуется: одно сообщение, два сообщения, пять сообщений.
 * Рассогласованное окончание в первой же фразе — то самое, из-за чего
 * переписка выглядит машинной.
 */
export function backlogIntro(count: number): string {
    const word = messageWord(count);
    return count === 1
        ? `Пока уведомления не были подключены, для вас накопилось одно ${word}. Присылаю его ниже.`
        : `Пока уведомления не были подключены, для вас накопилось ${count} ${word}. Присылаю их ниже.`;
}

function messageWord(count: number): string {
    const tail = count % 100;
    if (tail >= 11 && tail <= 14) return 'сообщений';
    switch (count % 10) {
        case 1: return 'сообщение';
        case 2:
        case 3:
        case 4: return 'сообщения';
        default: return 'сообщений';
    }
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
    /**
     * Строка перед накопленным. Зовётся ТОЛЬКО когда доставлять правда есть
     * что: предупреждать о пустоте — та же машинная бестактность, что и
     * молча вываливать три сообщения подряд.
     */
    announce?: (text: string) => Promise<void>;
    now?: Date;
}): Promise<FlushResult> {
    const now = params.now ?? new Date();
    const result: FlushResult = { sent: 0, skipped: 0, failed: 0 };

    const queued = await db.scheduledClientMessage.findMany({
        where: { clientId: params.clientId, channel: params.channel, status: 'pending' },
        orderBy: { createdAt: 'asc' },
    });

    // ОТБОР ЦЕЛИКОМ ДО ПЕРВОЙ ОТПРАВКИ: вступление называет количество, а
    // назвать его можно только зная, сколько уцелело после отбора.
    const deliverable: typeof queued = [];
    for (const message of queued) {
        const skip = await queuedMessageSkipReason(message, now);
        if (!skip) {
            deliverable.push(message);
            continue;
        }
        await db.scheduledClientMessage.update({
            where: { id: message.id },
            data: { status: 'failed', errorMsg: skip },
        });
        result.skipped += 1;
        // В журнал — только причина и канал: ни имени, ни текста.
        console.log(`[queued] ${skip} ${params.channel}`);
    }

    if (deliverable.length === 0) return result;

    if (params.announce) {
        // Не дошло вступление — накопленное всё равно уходит: молчаливая
        // доставка хуже, чем доставка без предисловия.
        await params.announce(backlogIntro(deliverable.length)).catch(() => undefined);
    }

    for (const message of deliverable) {
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
