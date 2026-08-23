import { db } from '@/lib/db';
import { clientActionToken, clientBookingLink, publicBaseUrl } from '@/lib/client-workflow';
import { sendTelegramMessage } from '../telegram';
import { sendMaxMessage as sendMaxText } from '../max';
import { sendMaxMessage as sendMaxFull } from '../max-bot';
import { build24hReminderText } from './reminder-text';

/** MAX-функции возвращают либо null (нет токена / HTTP не ok / исключение — см. maxApi в max-bot.ts),
 *  либо разобранный JSON-ответ, который может нести success:false при формально успешном HTTP-ответе. */
function maxSendOk(result: unknown): boolean {
    return result !== null && (result as { success?: boolean } | null)?.success !== false;
}

/**
 * Возвращает исход по каждому каналу: `true`/`false` — попытка была и её
 * результат, `null` — канал не был задействован (нет chat id). Нужно для
 * ReminderOutbox (O-260817-16): раньше отправка была "выстрелил и забыл", и
 * узнать, дошло ли сообщение, можно было только по консольным логам.
 */
async function sendNotification(
    tgChatId: string | null | undefined,
    maxChatId: string | null | undefined,
    text: string,
    options?: Parameters<typeof sendTelegramMessage>[2]
): Promise<{ telegram: boolean | null; max: boolean | null }> {
    let telegramOk: boolean | null = null;
    let maxOk: boolean | null = null;

    if (tgChatId) telegramOk = await sendTelegramMessage(tgChatId, text, options);
    if (maxChatId) {
        const telegramKeyboard = (options as any)?.reply_markup?.inline_keyboard;
        if (telegramKeyboard) {
            const maxButtons = telegramKeyboard.map((row: any[]) =>
                row.map((button: any) => button.url
                    ? { text: button.text, url: button.url }
                    : { text: button.text, payload: button.callback_data || button.payload || '' }
                )
            );
            maxOk = maxSendOk(await sendMaxFull(maxChatId, text.replace(/<[^>]+>/g, ''), maxButtons));
        } else {
            maxOk = maxSendOk(await sendMaxText(maxChatId, text.replace(/<[^>]+>/g, '')));
        }
    }

    return { telegram: telegramOk, max: maxOk };
}

/**
 * Журнал фактических отправок (O-260817-16, ReminderOutbox). Пишет
 * ОДНУ строку на пару (сессия, тип напоминания, канал) — повторный проход
 * cron по той же тройке обновляет её и увеличивает sendCount, а не плодит
 * дубли (см. @@unique в prisma/schema.prisma). Ошибка самой записи в
 * ReminderOutbox не должна ронять рассылку — это вторичный журнал, не
 * основной путь; поэтому обёрнута в try/catch, а не пробрасывается наружу.
 */
async function recordReminderOutbox(params: {
    type: 'session_24h_client' | 'session_24h_psychologist' | 'session_1h_client';
    channel: 'telegram' | 'max';
    recipient: string;
    sessionId: string;
    dueAt: Date;
    now: Date;
    ok: boolean;
}): Promise<void> {
    const { type, channel, recipient, sessionId, dueAt, now, ok } = params;
    try {
        await (db as any).reminderOutbox.upsert({
            where: { sessionId_type_channel: { sessionId, type, channel } },
            create: {
                type,
                channel,
                recipient,
                sessionId,
                dueAt,
                sentAt: ok ? now : null,
                status: ok ? 'sent' : 'error',
                error: ok ? null : `${channel} send failed — см. логи [Telegram]/[MAX API] около времени попытки`,
                sendCount: 1,
            },
            update: {
                sentAt: ok ? now : undefined,
                status: ok ? 'sent' : 'error',
                error: ok ? null : `${channel} send failed — см. логи [Telegram]/[MAX API] около времени попытки`,
                sendCount: { increment: 1 },
            },
        });
    } catch (error) {
        console.error('[processReminders] Не удалось записать ReminderOutbox:', error);
    }
}

/** Записывает исход sendNotification для каждого фактически задействованного канала. */
async function recordOutcome(
    outcome: { telegram: boolean | null; max: boolean | null },
    type: 'session_24h_client' | 'session_24h_psychologist' | 'session_1h_client',
    recipients: { telegram: string | null | undefined; max: string | null | undefined },
    sessionId: string,
    dueAt: Date,
    now: Date,
): Promise<void> {
    if (outcome.telegram !== null && recipients.telegram) {
        await recordReminderOutbox({ type, channel: 'telegram', recipient: recipients.telegram, sessionId, dueAt, now, ok: outcome.telegram });
    }
    if (outcome.max !== null && recipients.max) {
        await recordReminderOutbox({ type, channel: 'max', recipient: recipients.max, sessionId, dueAt, now, ok: outcome.max });
    }
}

function sessionActions(session: { id: string; psychologistId: string; clientId: string }, pending: boolean) {
    const token = clientActionToken(session.psychologistId, session.clientId);
    const actionUrl = (action: string) => `${publicBaseUrl()}/api/client/session-action?s=${session.id}&a=${action}&t=${token}`;
    const rows: Array<Array<{ text: string; url: string }>> = [];
    if (pending) rows.push([{ text: '✅ Подтвердить', url: actionUrl('confirm') }]);
    rows.push([
        { text: '🔄 Перенести', url: clientBookingLink(session.psychologistId, session.clientId) },
        { text: '❌ Отменить', url: actionUrl('cancel') },
    ]);
    return { reply_markup: { inline_keyboard: rows } };
}

export async function processReminders() {
    try {
        const now = new Date();
        const in24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000);
        const in1Hour = new Date(now.getTime() + 60 * 60 * 1000);
        const min24 = new Date(in24Hours.getTime() - 15 * 60 * 1000);
        const max24 = new Date(in24Hours.getTime() + 15 * 60 * 1000);

        const sessions24 = await db.diarySession.findMany({
            where: {
                status: { in: ['pending', 'confirmed'] },
                notified24h: false,
                date: { gte: min24, lte: max24 },
            } as any,
            include: {
                client: { include: { telegramClient: true } },
                psychologist: { include: { psychologistSettings: true } },
                address: true,
            },
        });

        for (const rawSession of sessions24) {
            const session = rawSession as any;
            const client = session.client;
            if (!client) continue;

            const onlineLink = session.psychologist?.psychologistSettings?.onlineSessionLink;
            const telegramId = client.telegramClient?.telegramUserId || client.telegramChatId;
            const maxId = client.telegramClient?.telegramUserId?.startsWith('max_') ? client.telegramClient.telegramUserId : client.maxChatId;
            const telegramTarget = maxId && telegramId === maxId ? null : telegramId;

            if (telegramTarget || maxId) {
                const message = build24hReminderText({
                    clientName: client.name,
                    time: session.time,
                    format: session.format,
                    addressName: session.address?.name,
                    onlineLink,
                    confirmationRequired: session.status === 'pending',
                });
                const outcome = await sendNotification(
                    telegramTarget,
                    maxId,
                    message,
                    sessionActions(session, session.status === 'pending'),
                );
                await recordOutcome(
                    outcome,
                    'session_24h_client',
                    { telegram: telegramTarget, max: maxId },
                    session.id,
                    new Date(session.date.getTime() - 24 * 60 * 60 * 1000),
                    now,
                );
            }

            const psychologistTelegramId = session.psychologist?.telegramChatId;
            const psychologistMaxId = session.psychologist?.maxChatId;
            if (psychologistTelegramId || psychologistMaxId) {
                const statusText = session.status === 'confirmed' ? 'подтверждена' : 'ожидает подтверждения';
                const message = `Завтра в ${session.time} сессия с клиентом ${client.name}. Статус: ${statusText}.`;
                const outcome = await sendNotification(psychologistTelegramId, psychologistMaxId, message, {
                    reply_markup: {
                        inline_keyboard: [[{ text: '👤 Профиль клиента', url: `https://cmpas.ru/diary/clients?clientId=${client.id}` }]],
                    },
                });
                await recordOutcome(
                    outcome,
                    'session_24h_psychologist',
                    { telegram: psychologistTelegramId, max: psychologistMaxId },
                    session.id,
                    new Date(session.date.getTime() - 24 * 60 * 60 * 1000),
                    now,
                );
            }

            await db.diarySession.update({
                where: { id: session.id },
                data: { notified24h: true } as any,
            });
        }

        const min1 = new Date(in1Hour.getTime() - 15 * 60 * 1000);
        const max1 = new Date(in1Hour.getTime() + 15 * 60 * 1000);
        const sessions1 = await db.diarySession.findMany({
            where: {
                status: { in: ['pending', 'confirmed'] },
                notified1h: false,
                date: { gte: min1, lte: max1 },
            } as any,
            include: {
                client: { include: { telegramClient: true } },
                psychologist: { include: { psychologistSettings: true } },
                address: true,
            },
        });

        for (const rawSession of sessions1) {
            const session = rawSession as any;
            const client = session.client;
            if (!client) continue;

            const onlineLink = session.psychologist?.psychologistSettings?.onlineSessionLink;
            const linkText = session.format === 'online' && onlineLink ? `\n🔗 Подключение: ${onlineLink}` : '';
            const telegramId = client.telegramClient?.telegramUserId || client.telegramChatId;
            const maxId = client.telegramClient?.telegramUserId?.startsWith('max_') ? client.telegramClient.telegramUserId : client.maxChatId;
            const telegramTarget = maxId && telegramId === maxId ? null : telegramId;

            if (telegramTarget || maxId) {
                const confirmationText = session.status === 'pending' ? '\nПодтвердите, пожалуйста, встречу.' : '';
                const message = `Сессия начнётся через 1 час, в ${session.time}.${linkText}${confirmationText}`;
                const outcome = await sendNotification(
                    telegramTarget,
                    maxId,
                    message,
                    sessionActions(session, session.status === 'pending'),
                );
                await recordOutcome(
                    outcome,
                    'session_1h_client',
                    { telegram: telegramTarget, max: maxId },
                    session.id,
                    new Date(session.date.getTime() - 60 * 60 * 1000),
                    now,
                );
            }

            await db.diarySession.update({
                where: { id: session.id },
                data: { notified1h: true } as any,
            });
        }
    } catch (error) {
        console.error('[processReminders] Ошибка вызова CRON:', error);
    }
}
