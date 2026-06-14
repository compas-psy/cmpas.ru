import { NextRequest, NextResponse } from 'next/server';
import { bot } from '@/lib/telegram-bot';
import { db } from '@/lib/db';
import { consumeClientChannelInvite } from '@/lib/channel-binding';

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms);
        promise
            .then(v => { clearTimeout(timer); resolve(v); })
            .catch(e => { clearTimeout(timer); reject(e); });
    });
}

async function handleClientInvite(body: any) {
    const text = body.message?.text as string | undefined;
    if (!text?.startsWith('/start c_')) return false;

    const rawToken = text.split(' ')[1]?.slice(2);
    const userId = body.message?.from?.id?.toString();
    const chatId = body.message?.chat?.id?.toString();
    if (!rawToken || !userId || !chatId || !bot) return false;

    try {
        const client = await consumeClientChannelInvite({
            token: rawToken,
            channel: 'telegram',
            providerUserId: userId,
            providerChatId: chatId,
            username: body.message?.from?.username || null,
        });

        await bot.telegram.sendMessage(
            chatId,
            `Уведомления подключены, ${client.name.split(/\s+/)[0]}!\n\nЗдесь будут только подтверждения, напоминания, переносы и отмены ваших записей.`,
        );

        const queued = await db.scheduledClientMessage.findMany({
            where: { clientId: client.id, channel: 'telegram', status: 'pending' },
            orderBy: { createdAt: 'asc' },
        });
        for (const message of queued) {
            try {
                await bot.telegram.sendMessage(chatId, message.text, {
                    parse_mode: 'HTML',
                    link_preview_options: { is_disabled: true },
                });
                await db.scheduledClientMessage.update({
                    where: { id: message.id },
                    data: { status: 'sent', sentAt: new Date() },
                });
            } catch (error) {
                await db.scheduledClientMessage.update({
                    where: { id: message.id },
                    data: { status: 'failed', errorMsg: error instanceof Error ? error.message : 'Telegram send failed' },
                });
            }
        }
    } catch (error) {
        const code = error instanceof Error ? error.message : '';
        const message = code === 'INVITE_ALREADY_USED'
            ? 'Эта ссылка уже использована. Попросите специалиста отправить новую.'
            : code === 'INVITE_EXPIRED'
                ? 'Срок действия ссылки истёк. Попросите специалиста отправить новую.'
                : 'Не удалось подключить уведомления. Попросите специалиста отправить новую ссылку.';
        await bot.telegram.sendMessage(chatId, message);
    }

    return true;
}

export async function POST(request: NextRequest) {
    if (!bot) {
        return NextResponse.json({ error: 'Telegram bot not configured' }, { status: 500 });
    }

    try {
        const body = await request.json();
        console.log('[TG Webhook] Received update:', body.update_id, body.message?.text || body.callback_query?.data || '(no text)');

        if (await handleClientInvite(body)) {
            return NextResponse.json({ success: true });
        }

        await withTimeout(bot.handleUpdate(body), 8000);
        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('[TG Webhook] Error:', error?.message || error);
        return NextResponse.json({ ok: true, error: error?.message }, { status: 200 });
    }
}

export async function GET() {
    return NextResponse.json({ status: 'Webhook endpoint active', bot: !!bot });
}
