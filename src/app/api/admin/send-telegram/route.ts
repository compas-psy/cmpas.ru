import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db';

export async function POST(request: NextRequest) {
    const session = await auth();
    const userRole = (session?.user as { role?: string })?.role;

    if (!session?.user || (userRole !== 'ADMIN' && userRole !== 'SUPERADMIN')) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { userId, message } = body;

    if (!userId || !message?.trim()) {
        return NextResponse.json({ error: 'userId and message are required' }, { status: 400 });
    }

    const user = await db.user.findUnique({
        where: { id: userId },
        select: { telegramChatId: true, name: true },
    });

    if (!user?.telegramChatId) {
        return NextResponse.json({ success: false, error: 'У пользователя не привязан Telegram' });
    }

    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
        return NextResponse.json({ success: false, error: 'TELEGRAM_BOT_TOKEN не настроен' });
    }

    try {
        const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: user.telegramChatId,
                text: message.trim(),
                parse_mode: 'HTML',
            }),
        });

        const data = await res.json();
        if (!data.ok) {
            return NextResponse.json({ success: false, error: data.description || 'Ошибка Telegram API' });
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message || 'Не удалось отправить сообщение' });
    }
}
