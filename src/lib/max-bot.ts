/**
 * MAX Messenger Bot (botapi.max.ru)
 *
 * MAX uses its own REST API (not Telegram-compatible):
 *   Auth: Authorization: TOKEN  (bare token in header — no Bearer/Token prefix)
 *   Webhook: POST /subscriptions
 *   Send: POST /messages/send?user_id=UID
 *   Incoming events: { update_type, message, callback, user, ... }
 */
import { db } from '@/lib/db';
import { format } from 'date-fns';

const MAX_API = 'https://botapi.max.ru';
const MAX_TOKEN = process.env.MAX_BOT_TOKEN;
const APP_URL = process.env.AUTH_URL || 'https://cmpas.ru';

/** Raw MAX update structure */
export type MaxUpdate = {
    update_id: number;
    update_type: string; // 'bot_started' | 'message_created' | 'callback_button_pressed'
    timestamp: number;
    message?: {
        sender: { user_id: number; name?: string; username?: string };
        recipient: { chat_id: string };
        body: { mid: string; text?: string };
    };
    callback?: {
        callback_id: string;
        user: { user_id: number };
        message: { body: { mid: string } };
        payload: string;
    };
    user?: { user_id: number; name?: string; username?: string };
};

const MAX_PREFIX = 'max_';
function maxId(uid: number | string) { return `${MAX_PREFIX}${uid}`; }

/** Call the MAX Bot API — uses bare Authorization header (no Bearer/Token prefix) */
async function maxApi(path: string, body?: Record<string, unknown>, query: Record<string, string> = {}) {
    if (!MAX_TOKEN) return null;
    const qs = new URLSearchParams(query);
    const qsStr = qs.toString();
    const url = `${MAX_API}${path}${qsStr ? '?' + qsStr : ''}`;
    try {
        const res = await fetch(url, {
            method: body ? 'POST' : 'GET',
            headers: {
                'Authorization': MAX_TOKEN,
                ...(body ? { 'Content-Type': 'application/json' } : {}),
            },
            body: body ? JSON.stringify(body) : undefined,
        });
        if (!res.ok) {
            console.error(`[MAX API] ${path} → ${res.status}:`, await res.text());
            return null;
        }
        return res.json();
    } catch (e) {
        console.error(`[MAX API] ${path} fetch error:`, e);
        return null;
    }
}

/** Send a text message to a user */
export async function sendMaxMessage(
    userId: string | number,
    text: string,
    buttons?: { text: string; url?: string; payload?: string }[][]
) {
    // userId may be prefixed with max_
    const uid = String(userId).replace(MAX_PREFIX, '');
    const body: Record<string, unknown> = { text };
    if (buttons?.length) {
        body.attachments = [{
            type: 'inline_keyboard',
            payload: {
                buttons: buttons.map(row =>
                    row.map(b => b.url
                        ? { type: 'link', text: b.text, url: b.url }
                        : { type: 'callback', text: b.text, payload: b.payload }
                    )
                )
            }
        }];
    }
    return maxApi('/messages/send', body, { user_id: uid });
}

/** Register webhook with MAX */
export async function registerMaxWebhook() {
    const webhookUrl = `${APP_URL}/api/max/webhook`;
    const result = await maxApi('/subscriptions', {
        url: webhookUrl,
        update_types: ['bot_started', 'message_created', 'callback_button_pressed'],
    });
    console.log('[MAX Bot] Webhook registration result:', JSON.stringify(result));
    return result;
}

/** Get bot info */
export async function getMaxBotInfo() {
    return maxApi('/me');
}

// ─────────────────────────────────────────────
// Update handlers
// ─────────────────────────────────────────────

async function handleStart(userId: number, payload: string | undefined) {
    const mid = maxId(userId);

    // Psychologist?
    const psy = await db.user.findFirst({ where: { maxChatId: mid } });
    if (psy) {
        return sendMaxMessage(userId,
            `Добро пожаловать в КОМПАС, ${psy.name || 'Специалист'}!\n\nВыберите действие:`,
            [
                [{ text: '💼 Открыть кабинет', url: `${APP_URL}/diary` }],
                [{ text: '🔗 Ссылка на запись', url: `${APP_URL}/bot/book/${psy.id}` }],
            ]
        );
    }

    // Booking link with psy_ID or psy_ID_c_ClientID?
    if (payload?.startsWith('psy_')) {
        let psychologistId = payload.replace('psy_', '');
        let linkClientId: string | undefined;

        if (psychologistId.includes('_c_')) {
            const [psyPart, clientPart] = psychologistId.split('_c_');
            psychologistId = psyPart;
            linkClientId = clientPart;
        }

        const targetPsy = await db.user.findUnique({
            where: { id: psychologistId },
            select: { name: true, psychologistSettings: { select: { fullName: true } } }
        });

        if (targetPsy) {
            const existing = await db.telegramClient.findUnique({ where: { telegramUserId: mid } });
            await db.telegramClient.upsert({
                where: { telegramUserId: mid },
                update: { psychologistId, diaryClientId: existing?.diaryClientId || linkClientId || null },
                create: { telegramUserId: mid, psychologistId, diaryClientId: linkClientId || null }
            });

            // Save maxChatId to DiaryClient so MAX notifications work
            if (linkClientId) {
                try {
                    await db.diaryClient.update({
                        where: { id: linkClientId },
                        data: { maxChatId: mid } as any,
                    });
                } catch (e) {
                    console.error('[MAX Bot] Failed to update DiaryClient.maxChatId:', e);
                }
            }

            const psyName = targetPsy.psychologistSettings?.fullName || targetPsy.name || 'Специалист';
            const bookUrl = linkClientId
                ? `${APP_URL}/bot/book/${psychologistId}?c=${linkClientId}`
                : `${APP_URL}/bot/book/${psychologistId}`;

            return sendMaxMessage(userId,
                `Добро пожаловать! Вы можете записаться к специалисту ${psyName}.`,
                [[{ text: '📅 Записаться', url: bookUrl }]]
            );
        }
    }

    // Known client? (look up by maxChatId)
    const client = await db.diaryClient.findFirst({ where: { maxChatId: mid } as any });
    if (client) {
        return sendMaxMessage(userId,
            `Добро пожаловать, ${client.name}!`,
            [
                [{ text: '📅 Записаться', url: `${APP_URL}/bot/book/${client.psychologistId}?c=${client.id}` }],
                [{ text: '🗓 Мои сессии', url: `${APP_URL}/bot/client` }],
            ]
        );
    }

    const tgClient = await db.telegramClient.findUnique({ where: { telegramUserId: mid } });
    if (tgClient?.psychologistId) {
        const bookUrl = tgClient.diaryClientId
            ? `${APP_URL}/bot/book/${tgClient.psychologistId}?c=${tgClient.diaryClientId}`
            : `${APP_URL}/bot/book/${tgClient.psychologistId}`;
        return sendMaxMessage(userId,
            `Добро пожаловать, ${tgClient.fullName || 'Клиент'}!`,
            [
                [{ text: '📅 Записаться', url: bookUrl }],
                [{ text: '🗓 Мои сессии', url: `${APP_URL}/bot/client` }],
            ]
        );
    }

    // Unknown user
    return sendMaxMessage(userId,
        'Добро пожаловать в КОМПАС!\n\nЕсли вы психолог — войдите в кабинет, чтобы привязать аккаунт.',
        [[{ text: '💼 Войти в кабинет', url: `${APP_URL}/diary/bot` }]]
    );
}

async function handleConnect(userId: number) {
    const mid = maxId(userId);
    try {
        const res = await fetch(`${APP_URL}/api/max/connect`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-bot-token': MAX_TOKEN! },
            body: JSON.stringify({ maxUserId: mid }),
        });
        const data = await res.json();
        if (data.url) {
            return sendMaxMessage(userId,
                'Нажмите кнопку ниже, чтобы привязать ваш MAX аккаунт к КОМПАС.\n\n⚠️ Ссылка действует 15 минут.',
                [[{ text: '🔗 Привязать аккаунт', url: data.url }]]
            );
        }
    } catch (e) {
        console.error('[MAX Bot] /connect error:', e);
    }
    return sendMaxMessage(userId, 'Не удалось создать ссылку. Попробуйте позже.');
}

async function handleSessions(userId: number) {
    const mid = maxId(userId);

    const psy = await db.user.findFirst({ where: { maxChatId: mid } });
    if (psy) {
        const sessions = await db.diarySession.findMany({
            where: { psychologistId: psy.id, status: 'confirmed', date: { gte: new Date() } },
            orderBy: [{ date: 'asc' }, { time: 'asc' }],
            take: 5,
            include: { client: true }
        });
        if (!sessions.length) return sendMaxMessage(userId, 'У вас нет предстоящих подтвержденных сессий.');
        let msg = '📅 Ваши ближайшие сессии:\n\n';
        sessions.forEach(s => {
            msg += `👤 ${s.client.name}\n⏰ ${format(s.date, 'dd.MM.yyyy')} в ${s.time}\n📍 ${s.format === 'offline' ? 'Очно' : 'Онлайн'}\n\n`;
        });
        return sendMaxMessage(userId, msg);
    }

    const client = await db.diaryClient.findFirst({ where: { maxChatId: mid } as any });
    if (client) {
        const sessions = await db.diarySession.findMany({
            where: { clientId: client.id, status: 'confirmed', date: { gte: new Date() } },
            orderBy: [{ date: 'asc' }, { time: 'asc' }]
        });
        if (!sessions.length) return sendMaxMessage(userId, 'У вас нет предстоящих записей.');
        let msg = '📅 Ваши записи:\n\n';
        sessions.forEach(s => {
            msg += `⏰ ${format(s.date, 'dd.MM.yyyy')} в ${s.time}\n📍 ${s.format === 'offline' ? 'Очно' : 'Онлайн'}\n\n`;
        });
        return sendMaxMessage(userId, msg);
    }

    return sendMaxMessage(userId, 'Аккаунт не найден. Перейдите по ссылке от вашего психолога.');
}

async function handleCallback(callbackId: string, userId: number, payload: string) {
    if (payload.startsWith('cancel_')) {
        const sessionId = payload.replace('cancel_', '');
        const mid = maxId(userId);
        const session = await db.diarySession.findUnique({
            where: { id: sessionId },
            include: { client: true }
        });
        if (!session || (session.client as any).maxChatId !== mid) {
            return sendMaxMessage(userId, 'Сессия не найдена или нет доступа.');
        }
        await db.diarySession.update({ where: { id: sessionId }, data: { status: 'cancelled' } });
        await sendMaxMessage(userId, `❌ Сессия отменена.\n\nДата: ${format(session.date, 'dd.MM.yyyy')} в ${session.time}`);

        // Notify psychologist
        if (session.client.psychologistId) {
            const psy = await db.user.findUnique({ where: { id: session.client.psychologistId } });
            if (psy?.maxChatId) {
                await sendMaxMessage(psy.maxChatId,
                    `❌ Клиент ${session.client.name} отменил сессию ${format(session.date, 'dd.MM.yyyy')} в ${session.time}.`
                );
            }
        }
    }

    // Answer callback (suppress loading state)
    await maxApi('/answers', {}, { callback_id: callbackId });
}

/** Main entry point — called from webhook route */
export async function handleMaxUpdate(update: MaxUpdate) {
    if (!MAX_TOKEN) return;

    try {
        if (update.update_type === 'bot_started') {
            const userId = update.user?.user_id;
            if (!userId) return;
            const payload = (update as any).payload; // deep link param
            await handleStart(userId, payload);
        }

        if (update.update_type === 'message_created' && update.message) {
            const userId = update.message.sender.user_id;
            const text = update.message.body.text?.trim() || '';

            if (text === '/start' || text.startsWith('/start ')) {
                const param = text.split(' ')[1];
                await handleStart(userId, param);
            } else if (text === '/connect') {
                await handleConnect(userId);
            } else if (text === '/sessions') {
                await handleSessions(userId);
            } else {
                // Default response
                await sendMaxMessage(userId,
                    'Используйте команды:\n/start — начало\n/sessions — мои сессии\n/connect — привязать аккаунт',
                    [[{ text: '💼 Открыть КОМПАС', url: `${APP_URL}/diary` }]]
                );
            }
        }

        if (update.update_type === 'callback_button_pressed' && update.callback) {
            await handleCallback(
                update.callback.callback_id,
                update.callback.user.user_id,
                update.callback.payload
            );
        }
    } catch (e) {
        console.error('[MAX Bot] handleMaxUpdate error:', e);
    }
}
