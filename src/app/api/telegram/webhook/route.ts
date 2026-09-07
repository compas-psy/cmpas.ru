import { NextRequest, NextResponse } from 'next/server';
import * as crypto from 'crypto';
import { bot } from '@/lib/telegram-bot';
import { processTelegramUpdate } from '@/lib/telegram/process-update';

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
        // Разбор и обработка — в общем модуле: тем же кодом пользуется
        // сторож доставки, когда Telegram до нас не достучался.
        await processTelegramUpdate(body);
        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('[TG Webhook] Error:', error?.message || error);
        return NextResponse.json({ ok: true, error: error?.message }, { status: 200 });
    }
}

export async function GET() {
    return NextResponse.json({ status: 'Webhook endpoint active', bot: !!bot });
}
