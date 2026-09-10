/**
 * Утренний дайджест и еженедельная сводка для психолога.
 * Принцип: не задалбывать. Одно сообщение утром, одно в понедельник.
 * Если сессий нет — молчим.
 */
import { db } from '@/lib/db';
import { deliverMessage } from '@/lib/messaging/deliver';
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, subWeeks } from 'date-fns';
import { ru } from 'date-fns/locale';

/**
 * Одна сводка — один канал, и с разметкой.
 *
 * Здесь было сразу две ошибки. Первая: писали и в Telegram, и в MAX — у кого
 * заведены оба, тот получал сводку дважды. Вторая тише и хуже: для MAX
 * разметка вырезалась целиком, `.replace(/<[^>]+>/g, '')` — вместе с ней
 * пропадали и АДРЕСА ссылок, и человек получал подпись, ведущую в никуда.
 * Отправка в MAX сама переводит разметку и прячет ссылки в кнопки — ей нужно
 * отдавать текст как есть.
 */
async function notify(tgId: string | null, maxId: string | null, text: string) {
    await deliverMessage({ telegramChatId: tgId, maxChatId: maxId, preferredChannel: null }, text);
}

/**
 * Утренний дайджест — вызывается cron ~08:00 МСК.
 * Одно сообщение со списком сессий на сегодня.
 */
export async function processMorningDigest() {
    try {
        const today = new Date();
        const dayStart = startOfDay(today);
        const dayEnd = endOfDay(today);

        // Находим всех психологов с включённым дайджестом
        const settings = await db.notificationSettings.findMany({
            where: { morningDigestEnabled: true },
            select: { psychologistId: true }
        });

        for (const { psychologistId } of settings) {
            const sessions = await db.diarySession.findMany({
                where: {
                    psychologistId,
                    date: { gte: dayStart, lte: dayEnd },
                    status: { not: 'cancelled' }
                },
                include: { client: { select: { name: true } } },
                orderBy: [{ time: 'asc' }]
            });

            // Если сессий нет — молчим (не задалбываем)
            if (sessions.length === 0) continue;

            const psy = await db.user.findUnique({
                where: { id: psychologistId },
                select: { telegramChatId: true, maxChatId: true, name: true }
            });
            if (!psy) continue;

            const dateStr = format(today, 'd MMMM, EEEE', { locale: ru });
            const count = sessions.length;
            const word = count === 1 ? 'сессия' : count < 5 ? 'сессии' : 'сессий';
            // Формат встречи — словом, а не значком: «💻» и «🏢» надо
            // расшифровывать, а «онлайн» и «в кабинете» читаются сразу.
            const lines = [
                `<b>${dateStr}</b>`,
                '',
                `Сегодня ${count} ${word}:`,
                '',
                ...sessions.map(s => `${s.time} — ${s.client.name}, ${s.format === 'online' ? 'онлайн' : 'в кабинете'}`),
            ];

            await notify(psy.telegramChatId, psy.maxChatId, lines.join('\n'));
        }
    } catch (error) {
        console.error('[processMorningDigest] Error:', error);
    }
}

/**
 * Еженедельная сводка — вызывается cron в понедельник ~10:00 МСК.
 * Краткая статистика за прошлую неделю.
 */
export async function processWeeklyDigest() {
    try {
        const now = new Date();
        const lastWeekStart = startOfWeek(subWeeks(now, 1), { weekStartsOn: 1 });
        const lastWeekEnd = endOfWeek(subWeeks(now, 1), { weekStartsOn: 1 });

        const settings = await db.notificationSettings.findMany({
            where: { weeklyDigestEnabled: true },
            select: { psychologistId: true }
        });

        for (const { psychologistId } of settings) {
            const allSessions = await db.diarySession.findMany({
                where: {
                    psychologistId,
                    date: { gte: lastWeekStart, lte: lastWeekEnd }
                },
                select: { status: true, clientId: true }
            });

            // Если сессий не было — молчим
            if (allSessions.length === 0) continue;

            // no_show — сессия состоялась по расписанию, просто без клиента;
            // для "сколько встреч было на этой неделе" считаем наравне с completed.
            const completed = allSessions.filter(s => s.status === 'completed' || s.status === 'confirmed' || s.status === 'no_show').length;
            const cancelled = allSessions.filter(s => s.status === 'cancelled').length;
            const uniqueClients = new Set(allSessions.map(s => s.clientId)).size;

            const newClients = await db.diaryClient.count({
                where: {
                    psychologistId,
                    createdAt: { gte: lastWeekStart, lte: lastWeekEnd }
                }
            });

            const psy = await db.user.findUnique({
                where: { id: psychologistId },
                select: { telegramChatId: true, maxChatId: true }
            });
            if (!psy) continue;

            const word = completed === 1 ? 'сессия' : completed < 5 ? 'сессии' : 'сессий';
            const lines = [
                '<b>Итоги недели</b>',
                '',
                `Проведено: ${completed} ${word}`,
                ...(cancelled > 0 ? [`Отменено: ${cancelled}`] : []),
                `Клиентов: ${uniqueClients}`,
                ...(newClients > 0 ? [`Новых: ${newClients}`] : []),
            ];

            await notify(psy.telegramChatId, psy.maxChatId, lines.join('\n'));
        }
    } catch (error) {
        console.error('[processWeeklyDigest] Error:', error);
    }
}
