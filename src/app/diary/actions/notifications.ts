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
                message = settings?.newBookingTemplate || 'Тестовое уведомление о новой записи';
                break;
            case 'reminder':
                message = settings?.reminderTemplate || 'Тестовое напоминание';
                break;
            case 'clientReminder25h':
                message = settings?.clientReminder25hTemplate || 'Тестовое напоминание (25ч)';
                break;
            case 'clientReminder1h':
                message = settings?.clientReminder1hTemplate || 'Тестовое напоминание (1ч)';
                break;
            case 'clientPsyCancel':
                message = settings?.clientPsyCancelTemplate || 'Тестовая отмена';
                break;
            default:
                message = 'Тестовое уведомление';
        }

        // Подставляем переменные
        for (const [key, value] of Object.entries(vars)) {
            message = message.replaceAll(key, value);
        }

        message = `[ТЕСТ] ${message}`;

        // Одно сообщение — один канал. Раньше писали и в Telegram, и в MAX:
        // человек с обоими мессенджерами получал каждое письмо дважды.
        const { deliverMessage } = await import('@/lib/messaging/deliver');
        const delivery = await deliverMessage(
            { telegramChatId: tgId, maxChatId: maxId, preferredChannel: null },
            message,
        );

        if (!delivery.sent) {
            return {
                success: false,
                error: delivery.channel
                    ? `Не удалось отправить в ${delivery.channel === 'max' ? 'MAX' : 'Telegram'}`
                    : 'У клиента не привязан мессенджер',
            };
        }

        return { success: true };
    } catch (e: any) {
        console.error('testNotification error:', e);
        return { success: false, error: e.message || 'Ошибка отправки' };
    }
}
