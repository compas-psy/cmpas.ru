import { NextRequest, NextResponse } from 'next/server';
import * as crypto from 'crypto';
import { bot } from '@/lib/telegram-bot';
import { db } from '@/lib/db';
import { consumeClientChannelInvite } from '@/lib/channel-binding';
import { extractFirstName } from '@/lib/person-name';

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

    // consumeClientChannelInvite is the only step that can legitimately fail
    // (bad/used/expired token). Everything after it is best-effort delivery —
    // a Telegram send failing here (e.g. connectivity from a RU-hosted server)
    // must NOT be reported back to the client as "linking failed", since the
    // link already succeeded in the database.
    let client;
    try {
        client = await consumeClientChannelInvite({
            token: rawToken,
            channel: 'telegram',
            providerUserId: userId,
            providerChatId: chatId,
            username: body.message?.from?.username || null,
        });
    } catch (error) {
        const code = error instanceof Error ? error.message : '';
        const message = code === 'INVITE_ALREADY_USED'
            ? 'Эта ссылка уже использована. Попросите специалиста отправить новую.'
            : code === 'INVITE_EXPIRED'
                ? 'Срок действия ссылки истёк. Попросите специалиста отправить новую.'
                : 'Не удалось подключить уведомления. Попросите специалиста отправить новую ссылку.';
        await bot.telegram.sendMessage(chatId, message).catch(e => console.error('[telegram-webhook] failure notice send failed:', e));
        return true;
    }

    try {
        await bot.telegram.sendMessage(
            chatId,
            `Уведомления подключены, ${extractFirstName(client.name) || client.name}!\n\nЗдесь будут только подтверждения, напоминания, переносы и отмены ваших записей.`,
        );
    } catch (error) {
        console.error('[telegram-webhook] confirmation send failed (link already succeeded):', error);
    }

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

    return true;
}

// Verifies Telegram's secret token (set via setWebhook's secret_token param and
// sent back on every update in this header). Without it, anyone who knows the
// public webhook URL can POST forged updates — e.g. a fake callback_query to
// confirm/cancel a guessed session, or a forged /start c_<token> consumption.
// Timing-safe compare. If TELEGRAM_WEBHOOK_SECRET is unset we fail OPEN (log a
// warning) so a misconfigured deploy doesn't silently drop all bot traffic;
// the deploy sets the secret, so in production this is enforced.
function verifyWebhookSecret(request: NextRequest): boolean {
    const expected = process.env.TELEGRAM_WEBHOOK_SECRET;
    if (!expected) {
        console.warn('[TG Webhook] TELEGRAM_WEBHOOK_SECRET not set — skipping authenticity check');
        return true;
    }
    const got = request.headers.get('x-telegram-bot-api-secret-token') || '';
    const a = Buffer.from(got);
    const b = Buffer.from(expected);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export async function POST(request: NextRequest) {
    if (!bot) {
        return NextResponse.json({ error: 'Telegram bot not configured' }, { status: 500 });
    }

    if (!verifyWebhookSecret(request)) {
        // Return 200 so a probing attacker can't distinguish "wrong secret" from
        // "endpoint down", and Telegram never retries on 200.
        return NextResponse.json({ ok: true }, { status: 200 });
    }

    try {
        const body = await request.json();
        // Do NOT log message text / callback data — that's client PII (152-ФЗ).
        console.log('[TG Webhook] update', body.update_id, body.message ? 'message' : body.callback_query ? 'callback' : 'other');

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
