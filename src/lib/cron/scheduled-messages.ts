import { db } from '@/lib/db';
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
                    const reminder = `📩 Пора отправить сообщение клиенту ${client?.name || ''}${client?.phone ? ` (${client.phone})` : ''}:\n\n${msg.text}`;
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
