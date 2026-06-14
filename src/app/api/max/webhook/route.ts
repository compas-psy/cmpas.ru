import { NextRequest, NextResponse } from 'next/server';
import { handleMaxUpdate, sendMaxMessage } from '@/lib/max-bot';
import { db } from '@/lib/db';
import { consumeClientChannelInvite } from '@/lib/channel-binding';

async function handleClientInvite(update: any) {
    if (update.update_type !== 'bot_started') return false;
    const payload = update.payload || update.start_payload;
    if (typeof payload !== 'string' || !payload.startsWith('c_')) return false;

    const userId = update.user?.user_id ?? update.message?.sender?.user_id;
    if (!userId) return false;

    const maxUserId = `max_${userId}`;
    try {
        const client = await consumeClientChannelInvite({
            token: payload.slice(2),
            channel: 'max',
            providerUserId: maxUserId,
            providerChatId: maxUserId,
            username: update.user?.username || null,
        });

        await sendMaxMessage(
            userId,
            `Уведомления подключены, ${client.name.split(/\s+/)[0]}!\n\nЗдесь будут только подтверждения, напоминания, переносы и отмены ваших записей.`,
        );

        const queued = await db.scheduledClientMessage.findMany({
            where: { clientId: client.id, channel: 'max', status: 'pending' },
            orderBy: { createdAt: 'asc' },
        });
        for (const message of queued) {
            try {
                await sendMaxMessage(userId, message.text.replace(/<[^>]+>/g, ''));
                await db.scheduledClientMessage.update({
                    where: { id: message.id },
                    data: { status: 'sent', sentAt: new Date() },
                });
            } catch (error) {
                await db.scheduledClientMessage.update({
                    where: { id: message.id },
                    data: { status: 'failed', errorMsg: error instanceof Error ? error.message : 'MAX send failed' },
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
        await sendMaxMessage(userId, message);
    }

    return true;
}

export async function POST(request: NextRequest) {
    if (!process.env.MAX_BOT_TOKEN) {
        return NextResponse.json({ error: 'MAX bot not configured' }, { status: 500 });
    }

    try {
        const update = await request.json();
        if (!(await handleClientInvite(update))) {
            await handleMaxUpdate(update);
        }
        return NextResponse.json({ ok: true });
    } catch (error) {
        console.error('[MAX webhook]:', error);
        return NextResponse.json({ error: 'Failed to process update' }, { status: 500 });
    }
}

export async function GET() {
    return NextResponse.json({ status: 'MAX webhook active' });
}
