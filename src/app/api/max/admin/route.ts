/**
 * MAX Bot diagnostic + webhook registration endpoint.
 * GET  /api/max/admin  — show status
 * POST /api/max/admin  — register webhook
 *
 * Protected by ADMIN_SECRET env var (or falls back to AUTH_SECRET).
 */
import { NextRequest, NextResponse } from 'next/server';

const MAX_TOKEN = process.env.MAX_BOT_TOKEN;
const MAX_API = 'https://botapi.max.ru';
const ADMIN_SECRET = process.env.ADMIN_SECRET || process.env.AUTH_SECRET;
const APP_URL = process.env.AUTH_URL || 'https://cmpas.ru';

function unauthorized() {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

function checkAuth(request: NextRequest) {
    const secret = request.nextUrl.searchParams.get('secret');
    return secret && (secret === ADMIN_SECRET || secret === MAX_TOKEN);
}

function maxFetch(path: string, options: RequestInit = {}) {
    return fetch(`${MAX_API}${path}`, {
        ...options,
        headers: {
            'Authorization': `Bearer ${MAX_TOKEN}`,
            ...(options.headers || {}),
        },
    });
}

export async function GET(request: NextRequest) {
    if (!checkAuth(request)) return unauthorized();

    const status: Record<string, unknown> = {
        MAX_BOT_TOKEN_set: !!MAX_TOKEN,
        MAX_BOT_TOKEN_prefix: MAX_TOKEN ? MAX_TOKEN.substring(0, 8) + '...' : null,
        webhook_url: `${APP_URL}/api/max/webhook`,
    };

    if (!MAX_TOKEN) {
        return NextResponse.json({ ...status, error: 'MAX_BOT_TOKEN not set in env' });
    }

    try {
        const meRes = await maxFetch('/me');
        status.bot_info = await meRes.json();
    } catch (e: any) {
        status.bot_info_error = e.message;
    }

    try {
        const subRes = await maxFetch('/subscriptions');
        status.subscriptions = await subRes.json();
    } catch (e: any) {
        status.subscriptions_error = e.message;
    }

    return NextResponse.json(status, { status: 200 });
}

export async function POST(request: NextRequest) {
    if (!checkAuth(request)) return unauthorized();

    if (!MAX_TOKEN) {
        return NextResponse.json({ error: 'MAX_BOT_TOKEN not set in env' }, { status: 500 });
    }

    const webhookUrl = `${APP_URL}/api/max/webhook`;

    try {
        await maxFetch('/subscriptions', { method: 'DELETE' }).catch(() => {});

        const res = await maxFetch('/subscriptions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                url: webhookUrl,
                version: '1',
                update_types: ['bot_started', 'message_created', 'callback_button_pressed'],
            }),
        });

        const result = await res.json();
        return NextResponse.json({ webhook_url: webhookUrl, status: res.status, result });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
