'use server';

import { db } from '@/lib/db';
import { getGeoFromIP } from '@/lib/geoip';
import { headers } from 'next/headers';
import { orderNotificationText } from '@/lib/orders/notification';

/**
 * ЗАЯВКА НА БУМАЖНЫЙ ЕЖЕДНЕВНИК.
 *
 * Дефекты Ф3 и Ф5 книги «Витрина и машинное отделение».
 *
 * Ф3. Поле «Сообщение» на экране было, и подсказка прямо звала написать
 * главное — количество экземпляров и вопрос по доставке. Форма это хранила,
 * а дальше текст исчезал: здесь такого поля не принимали, колонки в таблице
 * не было, в уведомление он не попадал. Отвечающий видел имя, телефон и
 * способ связи и перезванивал с вопросом, который человек уже задал. Там же
 * терялась метка посетителя: поле в базе есть и всегда было пустым, потому
 * что форма его не передавала.
 *
 * Ф5. Отправка шла прямым запросом в api.telegram.org — четвёртой копией
 * после трёх в кабинете учредителя, мимо прокси, таймаута и общих правил.
 * Теперь тем же путём, что и все остальные сообщения продукта.
 */

interface OrderData {
    name: string;
    phone: string;
    method: string;
    /** Слова человека: сколько экземпляров, вопрос по доставке. */
    message?: string;
    visitorId?: string;
}

export async function submitOrder(data: OrderData) {
    const headersList = await headers();
    const forwardedFor = headersList.get('x-forwarded-for');
    const realIp = headersList.get('x-real-ip');
    const ip = forwardedFor?.split(',')[0] || realIp || 'unknown';
    const userAgent = headersList.get('user-agent') || 'unknown';

    // Get GEO data
    const geo = await getGeoFromIP(ip);

    const message = (data.message || '').trim() || null;

    // Save order to database
    try {
        await db.order.create({
            data: {
                name: data.name,
                phone: data.phone,
                contactMethod: data.method,
                message,
                status: 'NEW',
                visitorId: data.visitorId || null,
                ipAddress: ip,
                userAgent: userAgent,
                country: geo.country,
                city: geo.city,
            },
        });
    } catch (error) {
        console.error('Order DB save error:', error);
        // Continue to Telegram even if DB fails
    }

    const chatId = process.env.TELEGRAM_CHAT_ID;
    if (!chatId) {
        console.error('[order] TELEGRAM_CHAT_ID не задан — заказ сохранён, уведомление не ушло');
        return { success: true, message: 'Order saved (Telegram disabled)' };
    }

    const text = orderNotificationText({
        name: data.name,
        phone: data.phone,
        method: data.method,
        message,
        city: geo.city,
        country: geo.country,
    });

    // Общий путь отправки: прокси, таймаут, единая обработка отказа. Свой
    // fetch здесь был последней прямой отправкой в Telegram во всём продукте.
    const { sendTelegramMessage } = await import('@/lib/telegram');
    const sent = await sendTelegramMessage(chatId, text);
    if (!sent) {
        // Заявка в базе есть, уведомление не ушло. Человеку отвечаем успехом
        // — его часть работы сделана, — но в журнале это видно, и заказ
        // находится на экране заказов в админке.
        console.error('[order] заказ сохранён, уведомление в Telegram не ушло');
        return { success: true, message: 'Order saved (Telegram failed)' };
    }

    return { success: true, message: 'Order sent successfully!' };
}
