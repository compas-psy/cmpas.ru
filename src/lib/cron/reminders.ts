import { db } from '@/lib/db';
import { clientActionToken, clientBookingLink, publicBaseUrl } from '@/lib/client-workflow';
import { sendTelegramMessage } from '../telegram';
import { sendMaxMessage as sendMaxText } from '../max';
import { sendMaxMessage as sendMaxFull } from '../max-bot';
import { build24hReminderText } from './reminder-text';

async function sendNotification(
    tgChatId: string | null | undefined,
    maxChatId: string | null | undefined,
    text: string,
    options?: Parameters<typeof sendTelegramMessage>[2]
) {
    if (tgChatId) await sendTelegramMessage(tgChatId, text, options);
    if (maxChatId) {
        const telegramKeyboard = (options as any)?.reply_markup?.inline_keyboard;
        if (telegramKeyboard) {
            const maxButtons = telegramKeyboard.map((row: any[]) =>
                row.map((button: any) => button.url
                    ? { text: button.text, url: button.url }
                    : { text: button.text, payload: button.callback_data || button.payload || '' }
                )
            );
            await sendMaxFull(maxChatId, text.replace(/<[^>]+>/g, ''), maxButtons);
        } else {
            await sendMaxText(maxChatId, text.replace(/<[^>]+>/g, ''));
        }
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
                await sendNotification(
                    telegramTarget,
                    maxId,
                    message,
                    sessionActions(session, session.status === 'pending'),
                );
            }

            const psychologistTelegramId = session.psychologist?.telegramChatId;
            const psychologistMaxId = session.psychologist?.maxChatId;
            if (psychologistTelegramId || psychologistMaxId) {
                const statusText = session.status === 'confirmed' ? 'подтверждена' : 'ожидает подтверждения';
                const message = `Завтра в ${session.time} сессия с клиентом ${client.name}. Статус: ${statusText}.`;
                await sendNotification(psychologistTelegramId, psychologistMaxId, message, {
                    reply_markup: {
                        inline_keyboard: [[{ text: '👤 Профиль клиента', url: `https://cmpas.ru/diary/clients?clientId=${client.id}` }]],
                    },
                });
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
                await sendNotification(
                    telegramTarget,
                    maxId,
                    message,
                    sessionActions(session, session.status === 'pending'),
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
