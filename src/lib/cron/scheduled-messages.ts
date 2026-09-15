import { db } from '@/lib/db';
import { queuedMessageSkipReason } from '@/lib/messaging/queued-delivery';
import { escapeHtml } from '@/lib/messaging/format';
import { sendTelegramMessage } from '../telegram';
import { sendMaxMessage as sendMaxFull } from '../max-bot';

/**
 * Process scheduled client messages that are due.
 * For "manual_pending" messages: notify the psychologist via Telegram/MAX push
 * that it's time to send a message manually.
 */
export async function processScheduledMessages() {
    const now = new Date();

    const due = await db.scheduledClientMessage.findMany({
        where: {
            status: { in: ['pending', 'manual_pending'] },
            sendAt: { lte: now },
        },
        take: 100,
    });

    if (!due.length) return;

    for (const msg of due) {
        try {
            if (msg.status === 'pending') {
                // Task 9 (founder review): a message tied to a specific
                // session (sessionId set) must respect that session's
                // clientNotificationsEnabled — this is client-facing
                // delivery. manual_pending below is unaffected: it only
                // notifies the PSYCHOLOGIST to send by hand.
                if (msg.sessionId) {
                    const session = await db.diarySession.findUnique({
                        where: { id: msg.sessionId },
                        select: { clientNotificationsEnabled: true },
                    });
                    if (session && !session.clientNotificationsEnabled) {
                        // Never leave it pending forever — a terminal state
                        // so it doesn't get reconsidered on every pass.
                        await db.scheduledClientMessage.update({
                            where: { id: msg.id },
                            data: { status: 'failed', errorMsg: 'CLIENT_NOTIFICATIONS_DISABLED' },
                        });
                        continue;
                    }
                }

                // ПРОТУХШЕЕ НЕ УЕЗЖАЕТ И ПО РАСПИСАНИЮ.
                //
                // Сообщение, которому некуда было уйти, кладётся в очередь
                // со сроком приглашения — тридцать дней. Всё это время оно
                // ждёт здесь, и без проверки крон отправил бы подтверждение
                // встречи, которая давно прошла. То же правило, что при
                // привязке мессенджера, и оно одно на оба пути.
                const stale = await queuedMessageSkipReason(msg, now);
                if (stale) {
                    await db.scheduledClientMessage.update({
                        where: { id: msg.id },
                        data: { status: 'failed', errorMsg: stale },
                    });
                    continue;
                }

                // Determine channel from stored value
                const client = await db.diaryClient.findUnique({
                    where: { id: msg.clientId },
                    select: { telegramChatId: true, maxChatId: true, name: true },
                });

                let sent = false;
                if (msg.channel === 'telegram' && client?.telegramChatId) {
                    await sendTelegramMessage(client.telegramChatId, msg.text);
                    sent = true;
                } else if (msg.channel === 'max' && (client as any)?.maxChatId) {
                    await sendMaxFull((client as any).maxChatId, msg.text);
                    sent = true;
                }

                await db.scheduledClientMessage.update({
                    where: { id: msg.id },
                    data: {
                        status: sent ? 'sent' : 'failed',
                        sentAt: sent ? now : null,
                        errorMsg: sent ? null : 'No messenger channel available',
                    },
                });

            } else if (msg.status === 'manual_pending') {
                // Notify the psychologist that it's time to send manually
                const psych = await db.user.findUnique({
                    where: { id: msg.psychologistId },
                    select: { telegramChatId: true, maxChatId: true, fcmToken: true },
                });
                const client = await db.diaryClient.findUnique({
                    where: { id: msg.clientId },
                    select: { name: true, phone: true },
                });

                if (psych?.telegramChatId || psych?.maxChatId) {
                    // Экранируется ВСЁ, что пришло из базы: и имя, и телефон,
                    // и сам текст сообщения. Сообщение уходит с разметкой, а
                    // текст здесь — свободный, написанный специалистом: одна
                    // угловая скобка в нём отменяет напоминание целиком.
                    const who = escapeHtml(client?.name || '');
                    const phone = client?.phone ? ` (${escapeHtml(client.phone)})` : '';
                    const reminder = `Пора отправить сообщение клиенту ${who}${phone}:\n\n${escapeHtml(msg.text)}`;
                    if (psych.telegramChatId) {
                        await sendTelegramMessage(psych.telegramChatId, reminder);
                    } else if (psych.maxChatId) {
                        await sendMaxFull(psych.maxChatId, reminder);
                    }
                }

                await db.scheduledClientMessage.update({
                    where: { id: msg.id },
                    data: { status: 'sent', sentAt: now },
                });
            }
        } catch (error) {
            console.error('[scheduled-messages] failed for', msg.id, error);
            await db.scheduledClientMessage.update({
                where: { id: msg.id },
                data: { status: 'failed', errorMsg: String(error).slice(0, 500) },
            }).catch(() => {});
        }
    }
}
