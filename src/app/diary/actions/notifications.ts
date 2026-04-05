'use server';

import { db } from '@/lib/db';
import { auth } from '@/auth';
import { revalidatePath } from 'next/cache';

async function getPsychologistId() {
    const session = await auth();
    if (!session?.user?.id) throw new Error('Unauthorized');
    return session.user.id;
}

export async function getNotificationSettings() {
    try {
        const psychologistId = await getPsychologistId();
        let settings = await (db as any).notificationSettings.findUnique({
            where: { psychologistId },
        });
        if (!settings) {
            settings = await (db as any).notificationSettings.create({
                data: { psychologistId },
            });
        }
        return { success: true, data: settings };
    } catch (e: any) {
        console.error('getNotificationSettings error:', e);
        return { success: false, error: e.message || 'Ошибка при получении настроек уведомлений' };
    }
}

export async function updateNotificationSettings(data: Record<string, any>) {
    try {
        const psychologistId = await getPsychologistId();
        const settings = await (db as any).notificationSettings.upsert({
            where: { psychologistId },
            create: { psychologistId, ...data },
            update: data,
        });
        revalidatePath('/diary/notifications');
        return { success: true, data: settings };
    } catch (e: any) {
        console.error('updateNotificationSettings error:', e);
        return { success: false, error: e.message || 'Ошибка при обновлении настроек' };
    }
}

export async function testNotification(type: string) {
    try {
        const psychologistId = await getPsychologistId();
        const user = await db.user.findUnique({ where: { id: psychologistId } });

        const tgId = user?.telegramChatId;
        const maxId = (user as any)?.maxChatId;

        if (!tgId && !maxId) {
            return { success: false, error: 'Ни Telegram, ни MAX не привязаны. Привяжите аккаунт в интеграциях.' };
        }

        const settings = await (db as any).notificationSettings.findUnique({
            where: { psychologistId },
        });

        let message = '';
        const now = new Date();
        const vars: Record<string, string> = {
            '{clientName}': 'Тестовый Клиент',
            '{date}': now.toLocaleDateString('ru-RU'),
            '{time}': '14:00',
            '{format}': 'Онлайн',
            '{psyName}': user?.name || 'Психолог',
            '{cancelLink}': 'https://t.me/your_bot',
        };

        switch (type) {
            case 'newBooking':
                message = settings?.newBookingTemplate || '🔥 Тестовое уведомление о новой записи';
                break;
            case 'reminder':
                message = settings?.reminderTemplate || '⏰ Тестовое напоминание';
                break;
            case 'clientReminder25h':
                message = settings?.clientReminder25hTemplate || '📋 Тестовое напоминание (25ч)';
                break;
            case 'clientReminder1h':
                message = settings?.clientReminder1hTemplate || '📋 Тестовое напоминание (1ч)';
                break;
            case 'clientPsyCancel':
                message = settings?.clientPsyCancelTemplate || '❌ Тестовая отмена';
                break;
            default:
                message = '🧪 Тестовое уведомление';
        }

        // Подставляем переменные
        for (const [key, value] of Object.entries(vars)) {
            message = message.replaceAll(key, value);
        }

        message = `[ТЕСТ] ${message}`;

        const errors: string[] = [];

        if (tgId) {
            try {
                const { Telegraf } = await import('telegraf');
                const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN!);
                await bot.telegram.sendMessage(tgId, message, { parse_mode: 'HTML' });
            } catch (e: any) {
                errors.push(`Telegram: ${e.message}`);
            }
        }

        if (maxId) {
            try {
                const { sendMaxMessage } = await import('@/lib/max-bot');
                await sendMaxMessage(maxId, message);
            } catch (e: any) {
                errors.push(`MAX: ${e.message}`);
            }
        }

        if (errors.length && errors.length === [tgId, maxId].filter(Boolean).length) {
            return { success: false, error: errors.join('; ') };
        }

        return { success: true };
    } catch (e: any) {
        console.error('testNotification error:', e);
        return { success: false, error: e.message || 'Ошибка отправки' };
    }
}
