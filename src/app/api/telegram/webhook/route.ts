import { NextRequest, NextResponse } from 'next/server';
import { bot } from '@/lib/telegram-bot';

// Wrap bot.handleUpdate with a timeout so Telegram doesn't get Connection Timed Out
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms);
        promise
            .then(v => { clearTimeout(timer); resolve(v); })
            .catch(e => { clearTimeout(timer); reject(e); });
    });
}

export async function POST(request: NextRequest) {
    if (!bot) {
        return NextResponse.json({ error: 'Telegram bot not configured' }, { status: 500 });
    }

    try {
        const body = await request.json();
        console.log('[TG Webhook] Received update:', body.update_id, body.message?.text || body.callback_query?.data || '(no text)');

        // 8s timeout — Telegram waits up to 60s but we want fast response
        await withTimeout(bot.handleUpdate(body), 8000);

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('[TG Webhook] Error:', error?.message || error);
        // Always return 200 to Telegram to prevent retries of broken updates
        return NextResponse.json({ ok: true, error: error?.message }, { status: 200 });
    }
}

export async function GET() {
    return NextResponse.json({ status: 'Webhook endpoint active', bot: !!bot });
}
