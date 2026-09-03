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

// MAX API uses bare token in Authorization header (no Bearer/Token prefix)
function maxFetch(path: string, options: RequestInit = {}) {
    return fetch(`${MAX_API}${path}`, {
        ...options,
        headers: {
            'Authorization': MAX_TOKEN!,
            ...(options.headers || {}),
        },
    });
}

export async function GET(request: NextRequest) {
    if (!checkAuth(request)) return unauthorized();
    if (!MAX_TOKEN) return NextResponse.json({ error: 'MAX_BOT_TOKEN not set' });

    const status: Record<string, unknown> = {
        MAX_BOT_TOKEN_set: true,
        MAX_BOT_TOKEN_prefix: MAX_TOKEN.substring(0, 12) + '...',
        webhook_url: `${APP_URL}/api/max/webhook`,
    };

    try {
        const r = await maxFetch('/me');
        status.bot_info = await r.json();
    } catch (e: any) { status.bot_info_error = e.message; }

    try {
        const r = await maxFetch('/subscriptions');
        status.subscriptions = await r.json();
    } catch (e: any) { status.subscriptions_error = e.message; }

    return NextResponse.json(status);
}

export async function POST(request: NextRequest) {
    if (!checkAuth(request)) return unauthorized();
    if (!MAX_TOKEN) return NextResponse.json({ error: 'MAX_BOT_TOKEN not set' }, { status: 500 });

    const webhookUrl = `${APP_URL}/api/max/webhook`;

    try {
        await maxFetch('/subscriptions', { method: 'DELETE' }).catch(() => {});

        const res = await maxFetch('/subscriptions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                url: webhookUrl,
                // Correct MAX API update_type names (NOT 'callback_button_pressed')
                update_types: ['bot_started', 'message_created', 'message_callback'],
                // MAX echoes this back as X-Max-Bot-Api-Secret on every delivery —
                // src/app/api/max/webhook/route.ts verifies it. Without it, the
                // deploy-generated MAX_WEBHOOK_SECRET is never registered with MAX
                // and the webhook silently falls back to fail-open.
                ...(process.env.MAX_WEBHOOK_SECRET ? { secret: process.env.MAX_WEBHOOK_SECRET } : {}),
            }),
        });

        const result = await res.json();
        return NextResponse.json({ webhook_url: webhookUrl, status: res.status, result });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
