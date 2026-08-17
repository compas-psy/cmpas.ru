/**
 * MAX Bot Account Linking API
 *
 * Flow:
 *   1. User sends /connect to MAX bot
 *   2. Bot calls this endpoint to generate a signed one-time link
 *   3. Bot sends the link to the user in MAX
 *   4. User clicks → opens /diary/max-connect?mid=...&sig=...
 *   5. If authenticated, maxChatId is saved
 *
 * This endpoint is called BY the MAX bot (server-to-server) to create a link.
 * It does not require a user session — it requires MAX_BOT_TOKEN for auth.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createHmac } from 'crypto';

const MAX_BOT_TOKEN = process.env.MAX_BOT_TOKEN;
// Подписывающий секрет обязателен. Значения по умолчанию быть не может:
// код репозитория публичен, и любая захардкоженная строка здесь означает,
// что кто угодно может подделать ссылку привязки MAX к чужому кабинету.
const LINK_SECRET = process.env.MAX_LINK_SECRET || process.env.AUTH_SECRET;
if (!LINK_SECRET) {
    throw new Error('MAX_LINK_SECRET или AUTH_SECRET обязателен: подписывать ссылки привязки MAX нечем.');
}

export async function POST(request: NextRequest) {
    // Validate that the request comes from the bot (shared secret)
    const auth = request.headers.get('x-bot-token');
    if (!MAX_BOT_TOKEN || auth !== MAX_BOT_TOKEN) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { maxUserId } = await request.json();
    if (!maxUserId) {
        return NextResponse.json({ error: 'maxUserId required' }, { status: 400 });
    }

    const expires = Date.now() + 15 * 60 * 1000; // 15 minutes
    const payload = `${maxUserId}:${expires}`;
    const sig = createHmac('sha256', LINK_SECRET).update(payload).digest('hex');

    const baseUrl = process.env.AUTH_URL || 'https://cmpas.ru';
    const url = `${baseUrl}/diary/max-connect?mid=${maxUserId}&exp=${expires}&sig=${sig}`;

    return NextResponse.json({ url });
}
