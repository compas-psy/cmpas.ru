import { NextRequest, NextResponse } from 'next/server';
import * as crypto from 'crypto';
import { handleMaxUpdate, sendMaxMessage, type MaxUpdate } from '@/lib/max-bot';
import { db } from '@/lib/db';
import { consumeClientChannelInvite } from '@/lib/channel-binding';
import { extractFirstName } from '@/lib/person-name';

// Verifies MAX's secret header (set via the "secret" field on POST
// /subscriptions and sent back on every update as X-Max-Bot-Api-Secret).
// Without it, anyone who knows the public webhook URL can POST forged
// updates — e.g. a fake bot_started with a guessed invite payload, or a
// forged message_created. Timing-safe compare, same pattern as the Telegram
// webhook (src/app/api/telegram/webhook/route.ts). Fail OPEN with a warning
// if MAX_WEBHOOK_SECRET is unset, so a misconfigured deploy doesn't silently
// drop all bot traffic; the deploy self-generates the secret.
function verifyWebhookSecret(request: NextRequest): boolean {
    const expected = process.env.MAX_WEBHOOK_SECRET;
    if (!expected) {
        console.warn('[MAX Webhook] MAX_WEBHOOK_SECRET not set — skipping authenticity check');
        return true;
    }
    const got = request.headers.get('x-max-bot-api-secret') || '';
    const a = Buffer.from(got);
    const b = Buffer.from(expected);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
}

type MaxWebhookUpdate = MaxUpdate & {
    payload?: string;
    start_payload?: string;
};

async function handleClientInvite(update: MaxWebhookUpdate) {
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
            `Уведомления подключены, ${extractFirstName(client.name) || client.name}!\n\nЗдесь будут только подтверждения, напоминания, переносы и отмены ваших записей.`,
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

    if (!verifyWebhookSecret(request)) {
        // Return 200 so a probing attacker can't distinguish "wrong secret"
        // from "endpoint down", and MAX never retries on 200.
        return NextResponse.json({ ok: true }, { status: 200 });
    }

    try {
        const update = await request.json() as MaxWebhookUpdate;
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
