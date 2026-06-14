import { NextRequest, NextResponse } from 'next/server';
import { consumeClientChannelInvite } from '@/lib/channel-binding';
import { verifyTelegramLoginPayload, type TelegramLoginPayload } from '@/lib/telegram-login';
import { sendTelegramMessage } from '@/lib/telegram';
import { db } from '@/lib/db';

const APP_URL = process.env.AUTH_URL || 'https://cmpas.ru';

export async function GET(request: NextRequest) {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const token = request.nextUrl.searchParams.get('token');
    if (!botToken || !token) {
        return NextResponse.redirect(`${APP_URL}/connect/success?status=error&channel=telegram`);
    }

    const payload: TelegramLoginPayload = {
        id: request.nextUrl.searchParams.get('id') || '',
        first_name: request.nextUrl.searchParams.get('first_name') || undefined,
        last_name: request.nextUrl.searchParams.get('last_name') || undefined,
        username: request.nextUrl.searchParams.get('username') || undefined,
        photo_url: request.nextUrl.searchParams.get('photo_url') || undefined,
        auth_date: request.nextUrl.searchParams.get('auth_date') || '',
        hash: request.nextUrl.searchParams.get('hash') || '',
    };

    if (!verifyTelegramLoginPayload(payload, botToken)) {
        return NextResponse.redirect(`${APP_URL}/connect/success?status=invalid&channel=telegram`);
    }

    try {
        const client = await consumeClientChannelInvite({
            token,
            channel: 'telegram',
            providerUserId: payload.id,
            providerChatId: payload.id,
            username: payload.username || null,
        });

        await sendTelegramMessage(
            payload.id,
            `Уведомления подключены, ${client.name.split(/\s+/)[0]}!\n\nЗдесь будут только подтверждения, напоминания, переносы и отмены ваших записей.`,
        );

        const queued = await db.scheduledClientMessage.findMany({
            where: { clientId: client.id, channel: 'telegram', status: 'pending' },
            orderBy: { createdAt: 'asc' },
        });
        for (const message of queued) {
            await sendTelegramMessage(payload.id, message.text, {
                parse_mode: 'HTML',
                disable_web_page_preview: true,
            });
            await db.scheduledClientMessage.update({
                where: { id: message.id },
                data: { status: 'sent', sentAt: new Date() },
            });
        }

        return NextResponse.redirect(`${APP_URL}/connect/success?status=ok&channel=telegram`);
    } catch (error) {
        const code = error instanceof Error ? error.message : 'UNKNOWN';
        const status = code === 'INVITE_ALREADY_USED' ? 'used' : code === 'INVITE_EXPIRED' ? 'expired' : 'error';
        return NextResponse.redirect(`${APP_URL}/connect/success?status=${status}&channel=telegram`);
    }
}
