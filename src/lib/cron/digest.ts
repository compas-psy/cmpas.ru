/**
 * Утренний дайджест и еженедельная сводка для психолога.
 * Принцип: не задалбывать. Одно сообщение утром, одно в понедельник.
 * Если сессий нет — молчим.
 */
import { db } from '@/lib/db';
import { sendTelegramMessage } from '../telegram';
import { sendMaxMessage } from '../max';
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, subWeeks } from 'date-fns';
import { ru } from 'date-fns/locale';

async function notify(tgId: string | null, maxId: string | null, text: string) {
    if (tgId) await sendTelegramMessage(tgId, text, { parse_mode: 'HTML' }).catch(console.error);
    if (maxId) await sendMaxMessage(maxId, text).catch(console.error);
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
            let msg = `☀️ <b>${dateStr}</b>\n\n`;
            msg += `📋 Сегодня ${sessions.length} ${sessions.length === 1 ? 'сессия' : sessions.length < 5 ? 'сессии' : 'сессий'}:\n\n`;

            sessions.forEach((s, i) => {
                const formatIcon = s.format === 'online' ? '💻' : '🏢';
                msg += `${s.time} — ${s.client.name} ${formatIcon}\n`;
            });

            await notify(psy.telegramChatId, psy.maxChatId, msg);
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

            const completed = allSessions.filter(s => s.status === 'completed' || s.status === 'confirmed').length;
            const cancelled = allSessions.filter(s => s.status === 'cancelled').length;
            const uniqueClients = new Set(allSessions.map(s => s.clientId)).size;

            // Новые клиенты за неделю
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

            let msg = `📊 <b>Итоги недели</b>\n\n`;
            msg += `✅ Проведено: ${completed} ${completed === 1 ? 'сессия' : completed < 5 ? 'сессии' : 'сессий'}\n`;
            if (cancelled > 0) msg += `❌ Отменено: ${cancelled}\n`;
            msg += `👥 Клиентов: ${uniqueClients}\n`;
            if (newClients > 0) msg += `🆕 Новых: ${newClients}\n`;

            await notify(psy.telegramChatId, psy.maxChatId, msg);
        }
    } catch (error) {
        console.error('[processWeeklyDigest] Error:', error);
    }
}
