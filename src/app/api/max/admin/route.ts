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

async function tryFetch(url: string, headers: Record<string, string> = {}) {
    try {
        const res = await fetch(url, { headers });
        const text = await res.text();
        try { return { status: res.status, body: JSON.parse(text) }; }
        catch { return { status: res.status, body: text }; }
    } catch (e: any) {
        return { error: e.message };
    }
}

export async function GET(request: NextRequest) {
    if (!checkAuth(request)) return unauthorized();

    if (!MAX_TOKEN) {
        return NextResponse.json({ error: 'MAX_BOT_TOKEN not set in env' });
    }

    const status: Record<string, unknown> = {
        MAX_BOT_TOKEN_set: true,
        MAX_BOT_TOKEN_prefix: MAX_TOKEN.substring(0, 12) + '...',
        webhook_url: `${APP_URL}/api/max/webhook`,
    };

    // Try all auth methods to find which one MAX accepts
    const meUrl = `${MAX_API}/me`;
    status.auth_tests = {
        query_param:    await tryFetch(`${MAX_API}/me?access_token=${MAX_TOKEN}`),
        bearer:         await tryFetch(meUrl, { 'Authorization': `Bearer ${MAX_TOKEN}` }),
        token_prefix:   await tryFetch(meUrl, { 'Authorization': `Token ${MAX_TOKEN}` }),
        bare:           await tryFetch(meUrl, { 'Authorization': MAX_TOKEN }),
    };

    // Also test subscriptions endpoint with query param
    status.subscriptions_query_param = await tryFetch(`${MAX_API}/subscriptions?access_token=${MAX_TOKEN}`);

    return NextResponse.json(status, { status: 200 });
}

export async function POST(request: NextRequest) {
    if (!checkAuth(request)) return unauthorized();
    if (!MAX_TOKEN) return NextResponse.json({ error: 'MAX_BOT_TOKEN not set' }, { status: 500 });

    const webhookUrl = `${APP_URL}/api/max/webhook`;
    const results: Record<string, unknown> = { webhook_url: webhookUrl };

    // Try to register webhook with all auth methods
    const body = JSON.stringify({
        url: webhookUrl,
        version: '1',
        update_types: ['bot_started', 'message_created', 'callback_button_pressed'],
    });

    for (const [name, headers] of [
        ['query_param', {}] as const,
        ['bearer', { 'Authorization': `Bearer ${MAX_TOKEN}` }] as const,
        ['token_prefix', { 'Authorization': `Token ${MAX_TOKEN}` }] as const,
        ['bare', { 'Authorization': MAX_TOKEN }] as const,
    ]) {
        const url = name === 'query_param'
            ? `${MAX_API}/subscriptions?access_token=${MAX_TOKEN}`
            : `${MAX_API}/subscriptions`;
        try {
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...headers },
                body,
            });
            const text = await res.text();
            let parsed;
            try { parsed = JSON.parse(text); } catch { parsed = text; }
            results[name] = { status: res.status, body: parsed };
            // If success (no error code), stop trying
            if (res.ok && !parsed?.code) {
                results.success_method = name;
                break;
            }
        } catch (e: any) {
            results[name] = { error: e.message };
        }
    }

    return NextResponse.json(results);
}
