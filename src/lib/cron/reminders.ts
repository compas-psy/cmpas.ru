import { db } from '@/lib/db';
import { sendTelegramMessage } from '../telegram';
import { sendMaxMessage } from '../max';

/** Отправляет уведомление через Telegram и/или MAX в зависимости от привязанных аккаунтов */
async function sendNotification(
    tgChatId: string | null | undefined,
    maxChatId: string | null | undefined,
    text: string,
    options?: Parameters<typeof sendTelegramMessage>[2]
) {
    if (tgChatId) await sendTelegramMessage(tgChatId, text, options);
    if (maxChatId) await sendMaxMessage(maxChatId, text);
}

/**
 * Проверка необходимости отправки напоминаний за 24 и 1 час до сессии
 */
export async function processReminders() {
    try {
        const now = new Date();
        const in24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000);
        const in1Hour = new Date(now.getTime() + 1 * 60 * 60 * 1000);

        // -- НАПОМИНАНИЯ ЗА 24 ЧАСА --
        // Ищем сессии, которые начнутся через ~24 часа (плюс-минус 15 минут) и еще не уведомлены
        const min24 = new Date(in24Hours.getTime() - 15 * 60 * 1000);
        const max24 = new Date(in24Hours.getTime() + 15 * 60 * 1000);

        const sessions24 = await db.diarySession.findMany({
            where: {
                status: 'confirmed',
                notified24h: false,
                date: {
                    gte: min24,
                    lte: max24
                }
            } as any,
            include: {
                client: { include: { telegramClient: true } },
                psychologist: { include: { psychologistSettings: true } },
                address: true
            }
        });

        for (const rawSession of sessions24) {
            const session = rawSession as any;
            const clientData = session.client;
            if (!clientData) continue;

            const psychName = session.psychologist?.name || 'Ваш психолог';
            const psychSettings = session.psychologist?.psychologistSettings;
            const onlineLink = psychSettings?.onlineSessionLink;
            const linkText = (session.format === 'online' && onlineLink) ? `\n🔗 Ссылка для подключения: ${onlineLink}` : '';

            // Уведомление клиенту
            const clientTgId = clientData.telegramClient?.telegramUserId || clientData.telegramChatId;
            // MAX: client may be stored with max_ prefix in telegramUserId
            const clientMaxId = clientData.telegramClient?.telegramUserId?.startsWith('max_')
                ? clientData.telegramClient.telegramUserId
                : null;
            const clientNotifyTg = clientMaxId ? null : clientTgId;

            if (clientTgId || clientMaxId) {
                const msg = `❗️Напоминание о сессии❗️\n\nЗдравствуйте, ${clientData.name}! Напоминаем о вашей встрече с психологом (${psychName}) завтра в ${session.time}.\nФормат: ${session.format === 'online' ? 'Онлайн' : 'Офлайн (кабинет: ' + (session.address?.name || 'Кабинет') + ')'}.${linkText}`;

                await sendNotification(clientNotifyTg, clientMaxId, msg, {
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: '✅ Подтвердить', callback_data: `confirm_session_${session.id}` }],
                            [{ text: '🔄 Перенести', callback_data: `reschedule_session_${session.id}` }, { text: '❌ Отменить', callback_data: `cancel_session_${session.id}` }]
                        ]
                    }
                });
            }

            // Уведомление психологу (Telegram + MAX)
            const psychTgId = session.psychologist?.telegramChatId;
            const psychMaxId = (session.psychologist as any)?.maxChatId;
            if (psychTgId || psychMaxId) {
                const msgPsych = `🔔 Напоминание: Завтра в ${session.time} сессия с клиентом ${clientData.name}.\nФормат: ${session.format === 'online' ? 'Онлайн' : 'Офлайн'}.`;
                await sendNotification(psychTgId, psychMaxId, msgPsych, {
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: '👤 Профиль клиента', url: `https://cmpas.ru/diary/clients?clientId=${clientData.id}` }]
                        ]
                    }
                });
            }

            // Обновляем флаг
            await db.diarySession.update({
                where: { id: session.id },
                data: { notified24h: true } as any
            });
        }

        // -- НАПОМИНАНИЯ ЗА 1 ЧАС --
        // Ищем сессии, которые начнутся через ~1 час
        const min1 = new Date(in1Hour.getTime() - 15 * 60 * 1000);
        const max1 = new Date(in1Hour.getTime() + 15 * 60 * 1000);

        const sessions1 = await db.diarySession.findMany({
            where: {
                status: 'confirmed',
                notified1h: false,
                date: {
                    gte: min1,
                    lte: max1
                }
            } as any,
            include: {
                client: { include: { telegramClient: true } },
                psychologist: { include: { psychologistSettings: true } },
                address: true
            }
        });

        for (const rawSession of sessions1) {
            const session = rawSession as any;
            const clientData = session.client;
            if (!clientData) continue;
            
            const psychSettings = session.psychologist?.psychologistSettings;
            const onlineLink = psychSettings?.onlineSessionLink;
            const linkText = (session.format === 'online' && onlineLink) ? `\n🔗 Подключение: ${onlineLink}` : '';

            const tgChatId1h = clientData.telegramClient?.telegramUserId?.startsWith('max_')
                ? null
                : (clientData.telegramClient?.telegramUserId || clientData.telegramChatId);
            const maxChatId1h = clientData.telegramClient?.telegramUserId?.startsWith('max_')
                ? clientData.telegramClient.telegramUserId
                : null;

            if (tgChatId1h || maxChatId1h) {
                const msg = `⏳ Сессия начнется через 1 час!\n\nЖдем вас в ${session.time}.${linkText}`;
                await sendNotification(tgChatId1h, maxChatId1h, msg);

                await db.diarySession.update({
                    where: { id: session.id },
                    data: { notified1h: true } as any
                });
            }
        }

    } catch (error) {
        console.error('[processReminders] Ошибка вызова CRON:', error);
    }
}
