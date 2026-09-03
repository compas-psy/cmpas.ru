/**
 * Пост-сессионные взаимодействия с клиентом.
 * Отправляется один раз через 30+ мин после endTime.
 * Только если психолог включил настройку clientMoodCheckEnabled.
 */
import { db } from '@/lib/db';
import { sendTelegramMessage } from '../telegram';
import { sendMaxMessage } from '../max';
import { isImportedSession } from '@/lib/practice/session-origin';

async function notifyClient(
    tgId: string | null | undefined,
    maxId: string | null | undefined,
    text: string,
    options?: any
) {
    if (tgId && !tgId.startsWith('max_')) {
        await sendTelegramMessage(tgId, text, { parse_mode: 'HTML', ...options }).catch(console.error);
    }
    if (maxId || (tgId && tgId.startsWith('max_'))) {
        const mid = maxId || tgId;
        if (mid) {
            // MAX: send with inline keyboard buttons if available
            const buttons = options?.reply_markup?.inline_keyboard?.map((row: any[]) =>
                row.map((b: any) => b.url
                    ? { text: b.text, url: b.url }
                    : { text: b.text, payload: b.callback_data }
                )
            );
            await (await import('../max-bot')).sendMaxMessage(
                mid.replace('max_', ''),
                text.replace(/<[^>]+>/g, ''), // Strip HTML for MAX
                buttons
            ).catch(console.error);
        }
    }
}

/**
 * Проверяет завершённые сессии и отправляет клиенту запрос оценки самочувствия.
 * Вызывается cron каждые 30 мин.
 */
export async function processPostSessionNudge() {
    try {
        const now = new Date();
        const thirtyMinAgo = new Date(now.getTime() - 30 * 60 * 1000);
        const threeHoursAgo = new Date(now.getTime() - 3 * 60 * 60 * 1000);

        // Ищем сессии, которые завершились 30 мин - 3 часа назад и ещё не nudged
        const sessions = await db.diarySession.findMany({
            where: {
                status: { in: ['confirmed', 'completed'] },
                postSessionNudged: false,
                date: { gte: new Date(new Date().setHours(0, 0, 0, 0)) }
            } as any,
            include: {
                client: { select: { id: true, name: true, telegramChatId: true, maxChatId: true, telegramClient: { select: { telegramUserId: true } } } },
                psychologist: {
                    select: {
                        id: true,
                        notificationSettings: { select: { clientMoodCheckEnabled: true } }
                    }
                }
            }
        });

        for (const session of sessions as any[]) {
            // Вычисляем время окончания сессии
            const [h, m] = (session.endTime || session.time).split(':').map(Number);
            const sessionEnd = new Date(session.date);
            sessionEnd.setHours(h, m, 0, 0);

            // Должно пройти минимум 30 мин, но не более 3 часов
            if (now < new Date(sessionEnd.getTime() + 30 * 60 * 1000)) continue;
            if (now > new Date(sessionEnd.getTime() + 3 * 60 * 60 * 1000)) {
                // Пропускаем старые — помечаем как nudged чтобы не проверять повторно
                await db.diarySession.update({
                    where: { id: session.id },
                    data: { postSessionNudged: true } as any
                });
                continue;
            }

            // Проверяем, включил ли психолог эту настройку
            const moodEnabled = session.psychologist?.notificationSettings?.clientMoodCheckEnabled;
            if (!moodEnabled) {
                await db.diarySession.update({
                    where: { id: session.id },
                    data: { postSessionNudged: true } as any
                });
                continue;
            }

            // Task 9: imported session — client never went through our
            // booking flow, don't ask them how the session went.
            if (isImportedSession(session)) {
                await db.diarySession.update({
                    where: { id: session.id },
                    data: { postSessionNudged: true } as any
                });
                continue;
            }

            const clientTgId = session.client?.telegramClient?.telegramUserId || session.client?.telegramChatId;
            const clientMaxId = session.client?.maxChatId;

            if (clientTgId || clientMaxId) {
                const msg = `💬 Спасибо за сессию, ${session.client.name}!\n\nКак вы себя чувствуете?`;

                await notifyClient(clientTgId, clientMaxId, msg, {
                    reply_markup: {
                        inline_keyboard: [
                            [
                                { text: '😊 Отлично', callback_data: `mood_1_${session.id}` },
                                { text: '🙂 Хорошо', callback_data: `mood_2_${session.id}` },
                            ],
                            [
                                { text: '😐 Нормально', callback_data: `mood_3_${session.id}` },
                                { text: '😔 Так себе', callback_data: `mood_4_${session.id}` },
                            ],
                            [
                                { text: '😢 Плохо', callback_data: `mood_5_${session.id}` },
                            ]
                        ]
                    }
                });
            }

            await db.diarySession.update({
                where: { id: session.id },
                data: { postSessionNudged: true } as any
            });
        }
    } catch (error) {
        console.error('[processPostSessionNudge] Error:', error);
    }
}
