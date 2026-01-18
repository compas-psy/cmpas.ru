'use server';

import { db } from '@/lib/db';
import { getGeoFromIP } from '@/lib/geoip';
import { headers } from 'next/headers';

interface OrderData {
    name: string;
    phone: string;
    method: string;
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

    // Save order to database
    try {
        await db.order.create({
            data: {
                name: data.name,
                phone: data.phone,
                contactMethod: data.method,
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

    // Send to Telegram
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    if (!token || !chatId) {
        console.error('Telegram config missing');
        return { success: true, message: 'Order saved (Telegram disabled)' };
    }

    const methodLabels: Record<string, string> = {
        'telegram': 'Telegram',
        'whatsapp': 'WhatsApp',
        'max': 'Max',
        'call': 'Звонок'
    };
    const readableMethod = methodLabels[data.method] || data.method;

    const locationInfo = geo.city && geo.country
        ? `\n📍 Локация: ${geo.city}, ${geo.country}`
        : '';

    const text = `🛒 Новый заказ!

👤 Имя: ${data.name}
📱 Телефон: ${data.phone}
💬 Способ связи: ${readableMethod}${locationInfo}`;

    try {
        const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                chat_id: chatId,
                text: text,
            }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error('Telegram API Error:', errorData);
            return { success: true, message: 'Order saved (Telegram failed)' };
        }

        return { success: true, message: 'Order sent successfully!' };
    } catch (error) {
        console.error('Network Error:', error);
        return { success: true, message: 'Order saved (Network error)' };
    }
}

