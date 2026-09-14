/**
 * Пост-сессионные взаимодействия с клиентом.
 * Отправляется один раз через 30+ мин после endTime.
 * Только если психолог включил настройку clientMoodCheckEnabled.
 */
import { db } from '@/lib/db';
import { isQuietHour } from '@/lib/messaging/quiet-hours';
import { deliverMessage } from '@/lib/messaging/deliver';
import { clientChannelBearer } from '@/lib/messaging/channel-rule';
import { escapeHtml } from '@/lib/messaging/format';
import { extractFirstName } from '@/lib/person-name';

/**
 * Вопрос о самочувствии уходит В ОДИН КАНАЛ.
 *
 * Здесь стояли два `if` подряд — тот же дефект, что был в рассылке
 * напоминаний: у кого привязаны и Telegram, и MAX, тот получал вечерний
 * вопрос дважды. Теперь канал выбирает общее правило продукта
 * (`deliverMessage` → `pickChannel`), и разметку в MAX переводит сама
 * отправка, а не регулярное выражение, срезавшее адрес вместе с тегом.
 *
 * Кнопки описываются один раз, в общем виде: перевод в диалект Telegram или
 * MAX делает `deliverMessage`.
 */

/**
 * Проверяет завершённые сессии и отправляет клиенту запрос оценки самочувствия.
 * Вызывается cron каждые 30 мин.
 */
export async function processPostSessionNudge() {
    try {
        const now = new Date();
        const thirtyMinAgo = new Date(now.getTime() - 30 * 60 * 1000);
        const threeHoursAgo = new Date(now.getTime() - 3 * 60 * 60 * 1000);

        // Ищем сессии, которые завершились 30 мин - 3 часа назад и ещё не nudged.
        // Task 9 (founder review): purely client-facing job, no
        // psychologist-facing counterpart shares this query — a session
        // with clientNotificationsEnabled=false never enters it at all, and
        // never gets postSessionNudged set, so re-enabling the flag later
        // picks it straight back up instead of it being closed out forever.
        const sessions = await db.diarySession.findMany({
            where: {
                status: { in: ['confirmed', 'completed'] },
                postSessionNudged: false,
                clientNotificationsEnabled: true,
                date: { gte: new Date(new Date().setHours(0, 0, 0, 0)) }
            } as any,
            include: {
                client: { select: { id: true, name: true, telegramChatId: true, maxChatId: true, preferredChannel: true, telegramClient: { select: { telegramUserId: true } } } },
                psychologist: {
                    select: {
                        id: true,
                        notificationSettings: { select: { clientMoodCheckEnabled: true } },
                        // Пояс практики: по нему считается, не ночь ли сейчас
                        // у человека, которому уйдёт вопрос о самочувствии.
                        psychologistSettings: { select: { timezone: true } }
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

            // НЕ БУДИМ. Встреча, закончившаяся в 23:00, давала этот вопрос
            // в 23:30. Сессия остаётся неотмеченной — но окно у этого
            // каскада три часа, и если оно целиком пришлось на ночь,
            // сообщение не уйдёт вовсе. Это и правильно: «как вы после
            // встречи?» наутро — вопрос не о том.
            if (isQuietHour(session.psychologist?.psychologistSettings?.timezone, now)) continue;

            // Проверяем, включил ли психолог эту настройку
            const moodEnabled = session.psychologist?.notificationSettings?.clientMoodCheckEnabled;
            if (!moodEnabled) {
                await db.diarySession.update({
                    where: { id: session.id },
                    data: { postSessionNudged: true } as any
                });
                continue;
            }

            // Имя — то, как человека зовут, а не полная запись из карточки:
            // «Спасибо за сессию, Мартынова Ирина Петровна» звучит как письмо
            // из банка. Сообщение о встрече обращается по имени, и вечерний
            // вопрос обязан звучать так же.
            const msg = `Спасибо за сессию, ${escapeHtml(extractFirstName(session.client.name) || session.client.name)}!\n\nКак вы себя чувствуете?`;

            await deliverMessage(clientChannelBearer(session.client), msg, [
                [
                    { text: 'Отлично', payload: `mood_1_${session.id}` },
                    { text: 'Хорошо', payload: `mood_2_${session.id}` },
                ],
                [
                    { text: 'Нормально', payload: `mood_3_${session.id}` },
                    { text: 'Так себе', payload: `mood_4_${session.id}` },
                ],
                [
                    { text: 'Плохо', payload: `mood_5_${session.id}` },
                ],
            ]);

            await db.diarySession.update({
                where: { id: session.id },
                data: { postSessionNudged: true } as any
            });
        }
    } catch (error) {
        console.error('[processPostSessionNudge] Error:', error);
    }
}
