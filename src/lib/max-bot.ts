/**
 * MAX Messenger Bot (platform-api2.max.ru)
 *
 * MAX uses its own REST API (not Telegram-compatible):
 *   Auth: Authorization: TOKEN  (bare token in header — no Bearer/Token prefix)
 *   Webhook: POST /subscriptions
 *   Send: POST /messages/send?user_id=UID
 *   Incoming events: { update_type, message, callback, user, ... }
 *
 * Base URL: MAX migrated from platform-api.max.ru to platform-api2.max.ru
 * (19.07.2026); current docs use it for every method (/me, /messages,
 * /subscriptions, ...), not just subscription registration — a single base
 * URL for all of maxApi(), not two parallel ones.
 */
import { db } from '@/lib/db';
import { format } from 'date-fns';
import { createNotification } from '@/lib/notifications';
import { autoDeleteSessionFromCalendars } from '@/lib/calendar/auto-sync';
import { canClientCancel, clientCancelBlockedMessage } from '@/lib/client-cancellation';
import { consumeClientChannelInvite, channelInviteFailureMessage } from '@/lib/channel-binding';
import { sessionActionToken, sessionActionTokenExpiry, personalClientToken } from '@/lib/client-workflow';
import { previewContactIntake, commitContactIntake } from '@/lib/clients/contact-intake';
import { previewMessage, commitMessage } from '@/lib/clients/contact-intake-messages';
import { htmlToPlain, extractLinksForButtons } from '@/lib/messaging/format';

const MAX_API = 'https://platform-api2.max.ru';
const MAX_TOKEN = process.env.MAX_BOT_TOKEN;
const APP_URL = process.env.AUTH_URL || 'https://cmpas.ru';

/** Вложение входящего сообщения MAX. Нас интересует только contact. */
export type MaxAttachment = {
    type: string;
    payload?: {
        vcf_info?: string;
        max_info?: { user_id?: number; first_name?: string; last_name?: string; name?: string } | null;
    };
};

export type MaxUpdate = {
    update_id: number;
    update_type: string;
    timestamp: number;
    message?: {
        sender: { user_id: number; name?: string; username?: string };
        recipient: { chat_id: string };
        // Вложения: MAX кладёт сюда в том числе пересланный контакт
        // (type: 'contact', payload.vcf_info — строка vCard). Раньше поле
        // не читалось вовсе, и контакт для бота не существовал.
        body: { mid: string; text?: string; attachments?: MaxAttachment[] };
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

/**
 * Запомнить идентификатор ДИАЛОГА клиента в MAX.
 *
 * maxChatId — это user_id: им пишут человеку, но по нему нельзя спросить у
 * MAX его аватарку — GET /chats/{chat_id} отдаёт dialog_with_user только по
 * идентификатору диалога. Диалог приходит в каждом входящем сообщении,
 * поэтому поле заполняется само, без единого лишнего запроса.
 *
 * Хранится ИДЕНТИФИКАТОР, а не фотография: сама аватарка не сохраняется
 * нигде и запрашивается в момент показа (src/lib/clients/avatar.ts).
 *
 * Ошибка здесь ничего не должна ломать: не записали — у клиента просто
 * останутся инициалы, а сообщение обработается как обычно.
 */
async function rememberMaxDialog(userId: number | string, chatId?: string | number | null) {
    if (chatId === undefined || chatId === null || chatId === '') return;
    try {
        await db.diaryClient.updateMany({
            where: { maxChatId: maxId(userId), maxDialogId: null },
            data: { maxDialogId: String(chatId) },
        });
    } catch (e) {
        console.error('[MAX Bot] Не удалось запомнить диалог:', e instanceof Error ? e.message : e);
    }
}

async function maxApi(path: string, body?: Record<string, unknown>, query: Record<string, string> = {}) {
    if (!MAX_TOKEN) return null;
    const qs = new URLSearchParams(query);
    const url = `${MAX_API}${path}${qs.toString() ? '?' + qs.toString() : ''}`;
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
            const text = await res.text();
            console.error(`[MAX API] ${path} → ${res.status}:`, text);
            return null;
        }
        const result = await res.json();
        if (result && result.success === false) console.error(`[MAX API] ${path} returned success=false:`, JSON.stringify(result));
        return result;
    } catch (e) {
        console.error(`[MAX API] ${path} fetch error:`, e);
        return null;
    }
}

export async function sendMaxMessage(
    userId: string | number,
    text: string,
    buttons?: { text: string; url?: string; payload?: string }[][]
) {
    const uid = String(userId).replace(MAX_PREFIX, '');

    // MAX не понимает разметку Telegram. Перевод стоит ЗДЕСЬ, на единственной
    // двери в MAX: забыть его в отдельном сообщении невозможно, потому что
    // мимо этой функции в MAX ничего не уходит.
    //
    // Ссылки при этом не расплющиваются в адрес, а уезжают КНОПКАМИ: у MAX
    // нет разметки, но кнопки со ссылкой есть. Прежний перевод давал
    // «Выбрать время: https://…» — и учредитель справедливо сказал, что
    // ссылка снова не за словом.
    const extracted = extractLinksForButtons(text);
    const body: Record<string, unknown> = { text: htmlToPlain(extracted.text) };

    // Кнопки вызывающего идут первыми: они — про действие («Записаться»,
    // «Отменить»), а вынутые ссылки лишь сопровождают текст.
    type MaxButton = { text: string; url?: string; payload?: string };
    const rows: MaxButton[][] = [
        ...(buttons ?? []),
        ...extracted.links.map(l => [{ text: l.label, url: l.url } as MaxButton]),
    ];

    if (rows.length) {
        body.attachments = [{
            type: 'inline_keyboard',
            payload: {
                buttons: rows.map(row => row.map(b => b.url
                    ? { type: 'link', text: b.text, url: b.url }
                    : { type: 'callback', text: b.text, payload: b.payload }
                ))
            }
        }];
    }
    return maxApi('/messages', body, { user_id: uid });
}

export async function registerMaxWebhook() {
    const webhookUrl = `${APP_URL}/api/max/webhook`;
    const secret = process.env.MAX_WEBHOOK_SECRET;
    const result = await maxApi('/subscriptions', {
        url: webhookUrl,
        update_types: ['bot_started', 'message_created', 'message_callback'],
        // Echoed back as X-Max-Bot-Api-Secret on every delivery — verified in
        // src/app/api/max/webhook/route.ts.
        ...(secret ? { secret } : {}),
    });
    console.log('[MAX Bot] Webhook registration result:', JSON.stringify(result));
    return result;
}

export async function getMaxBotInfo() {
    return maxApi('/me');
}

async function handleStart(userId: number, payload: string | undefined) {
    const mid = maxId(userId);
    const psy = await db.user.findFirst({ where: { maxChatId: mid } });
    if (psy) {
        return sendMaxMessage(userId,
            `Добро пожаловать в ПРАКТИКУ, ${psy.name || 'Специалист'}!\n\nВыберите действие:`,
            [[{ text: 'Открыть кабинет', url: `${APP_URL}/diary` }], [{ text: 'Ссылка на запись', url: `${APP_URL}/bot/book/${psy.id}` }]]
        );
    }

    // Invite token (c_<token>) — psychologist invited this client via CONNECT-1.
    // Mirrors telegram-bot.ts's handling exactly: use the canonical
    // consumeClientChannelInvite, never re-derive/compare the raw token here.
    if (payload?.startsWith('c_')) {
        const token = payload.slice(2);
        try {
            const client = await consumeClientChannelInvite({
                token,
                channel: 'max',
                providerUserId: mid,
                providerChatId: mid,
                username: undefined,
            });

            await sendMaxMessage(userId,
                `Здравствуйте, ${client.name}!\n\nВаш аккаунт успешно привязан к специалисту. Теперь вы будете получать уведомления о встречах здесь.`,
            );

            try {
                const queued = await db.scheduledClientMessage.findMany({
                    where: { clientId: client.id, channel: 'max', status: 'pending' },
                    orderBy: { createdAt: 'asc' },
                });
                for (const m of queued) {
                    try {
                        await sendMaxMessage(userId, m.text);
                        await db.scheduledClientMessage.update({
                            where: { id: m.id },
                            data: { status: 'sent', sentAt: new Date() },
                        });
                    } catch (e) {
                        console.error('[MAX Bot] queued onboarding delivery failed:', e);
                    }
                }
            } catch (e) {
                console.error('[MAX Bot] queued onboarding lookup failed:', e);
            }
            return;
        } catch (e) {
            const code = e instanceof Error ? e.message : '';
            return sendMaxMessage(userId, channelInviteFailureMessage(code));
        }
    }

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
            if (linkClientId) {
                try {
                    await db.diaryClient.update({ where: { id: linkClientId }, data: { maxChatId: mid } as any });
                } catch (e) {
                    console.error('[MAX Bot] Failed to update DiaryClient.maxChatId:', e);
                }
            }
            const psyName = targetPsy.psychologistSettings?.fullName || targetPsy.name || 'Специалист';
            const bookUrl = linkClientId ? `${APP_URL}/bot/book/${psychologistId}?c=${personalClientToken(linkClientId)}` : `${APP_URL}/bot/book/${psychologistId}`;
            return sendMaxMessage(userId, `Добро пожаловать! Вы можете записаться к специалисту ${psyName}.`, [[{ text: 'Записаться', url: bookUrl }]]);
        }
    }

    const client = await db.diaryClient.findFirst({ where: { maxChatId: mid } });
    if (client) {
        return sendMaxMessage(userId, `Добро пожаловать, ${client.name}!`, [
            [{ text: 'Записаться', url: `${APP_URL}/bot/book/${client.psychologistId}?c=${personalClientToken(client.id)}` }],
            [{ text: 'Мои сессии', url: `${APP_URL}/bot/client` }],
        ]);
    }

    const tgClient = await db.telegramClient.findUnique({ where: { telegramUserId: mid } });
    if (tgClient?.psychologistId) {
        const bookUrl = tgClient.diaryClientId ? `${APP_URL}/bot/book/${tgClient.psychologistId}?c=${personalClientToken(tgClient.diaryClientId)}` : `${APP_URL}/bot/book/${tgClient.psychologistId}`;
        return sendMaxMessage(userId, `Добро пожаловать, ${tgClient.fullName || 'Клиент'}!`, [
            [{ text: 'Записаться', url: bookUrl }],
            [{ text: 'Мои сессии', url: `${APP_URL}/bot/client` }],
        ]);
    }

    return sendMaxMessage(userId,
        'Добро пожаловать в ПРАКТИКУ!\n\nЕсли вы психолог — войдите в кабинет и привяжите MAX через раздел Интеграции.',
        [[{ text: 'Войти в кабинет', url: `${APP_URL}/diary/integrations` }]]
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
        if (data.url) return sendMaxMessage(userId, 'Нажмите кнопку ниже, чтобы привязать ваш MAX аккаунт к ПРАКТИКЕ.\n\nСсылка действует 15 минут.', [[{ text: 'Привязать аккаунт', url: data.url }]]);
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
        let msg = 'Ваши ближайшие сессии:\n\n';
        sessions.forEach(s => { msg += `${s.client.name}\n${format(s.date, 'dd.MM.yyyy')} в ${s.time}\n${s.format === 'offline' ? 'Очно' : 'Онлайн'}\n\n`; });
        return sendMaxMessage(userId, msg);
    }

    const client = await db.diaryClient.findFirst({ where: { maxChatId: mid } });
    if (client) {
        const sessions = await db.diarySession.findMany({
            where: { clientId: client.id, status: 'confirmed', date: { gte: new Date() } },
            orderBy: [{ date: 'asc' }, { time: 'asc' }]
        });
        if (!sessions.length) return sendMaxMessage(userId, 'У вас нет предстоящих записей.');
        let msg = 'Ваши записи:\n\n';
        sessions.forEach(s => { msg += `${format(s.date, 'dd.MM.yyyy')} в ${s.time}\n${s.format === 'offline' ? 'Очно' : 'Онлайн'}\n\n`; });
        return sendMaxMessage(userId, msg);
    }

    return sendMaxMessage(userId, 'Аккаунт не найден. Перейдите по ссылке от вашего психолога.');
}

async function handleHelp(userId: number) {
    const mid = maxId(userId);
    const psy = await db.user.findFirst({ where: { maxChatId: mid } });
    if (psy) {
        return sendMaxMessage(userId,
            'Доступные команды:\n\n/sessions — ваши ближайшие сессии\n/link — ссылка для записи клиентов\n/help — эта справка\n\nТакже вы можете открыть кабинет по кнопке ниже.',
            [[{ text: 'Открыть кабинет', url: `${APP_URL}/diary` }], [{ text: 'Календарь', url: `${APP_URL}/diary/calendar` }]]
        );
    }
    return sendMaxMessage(userId, 'Доступные команды:\n\n/sessions — ваши ближайшие записи\n/help — эта справка\n/connect — привязать аккаунт психолога', [[{ text: 'Открыть ПРАКТИКУ', url: `${APP_URL}/diary` }]]);
}

async function handleShareLink(userId: number) {
    const mid = maxId(userId);
    const psy = await db.user.findFirst({ where: { maxChatId: mid } });
    if (!psy) return sendMaxMessage(userId, 'Эта команда доступна только для психологов.');
    const bookUrl = `${APP_URL}/bot/book/${psy.id}`;
    // Адрес в тексте не повторяем: он уже есть в кнопке ниже, а вклеенный в
    // середину сообщения занимал полторы строки и ничего не пояснял.
    return sendMaxMessage(userId, 'Кнопка ниже открывает вашу страницу записи. Перешлите это сообщение клиенту — он сможет выбрать удобное время.', [[{ text: 'Открыть страницу записи', url: bookUrl }]]);
}

/**
 * Специалист переслал боту контакт клиента.
 *
 * Разбор, сверка с базой и создание — в общем модуле: Telegram делает
 * ровно то же самое, и расходиться эти пути не должны. Здесь только
 * доставка: MAX присылает контакт строкой vCard, а не полями.
 */
async function handleContactShared(userId: number, payload: NonNullable<MaxAttachment['payload']>) {
    const preview = await previewContactIntake({
        source: 'max',
        senderChatId: maxId(userId),
        contact: { vcf_info: payload.vcf_info, max_info: payload.max_info },
    });

    const reply = previewMessage(preview, APP_URL);
    if (!reply) return;

    await sendMaxMessage(
        userId,
        reply.text,
        reply.buttons.length > 0
            ? reply.buttons.map((b) => [b.url ? { text: b.label, url: b.url } : { text: b.label, payload: b.payload }])
            : undefined
    );
}

async function handleContactIntakeCallback(callbackId: string, userId: number, payload: string) {
    await maxApi(`/answers/${callbackId}`, {});

    const psy = await db.user.findFirst({ where: { maxChatId: maxId(userId) }, select: { id: true } });
    if (!psy) return;

    const kind = payload.startsWith('intake_ok_') ? 'create' : payload.startsWith('intake_fill_') ? 'fill' : 'cancel';
    const draftId = payload.replace('intake_ok_', '').replace('intake_fill_', '').replace('intake_no_', '');

    const result = await commitContactIntake({ draftId, psychologistId: psy.id, action: kind });
    const done = commitMessage(result, APP_URL);
    await sendMaxMessage(userId, done.text, done.buttons.length > 0
        ? done.buttons.map((b) => [b.url ? { text: b.label, url: b.url } : { text: b.label, payload: b.payload }])
        : undefined);
}

async function handleCallback(callbackId: string, userId: number, payload: string) {
    const mid = maxId(userId);

    if (payload.startsWith('intake_ok_') || payload.startsWith('intake_fill_') || payload.startsWith('intake_no_')) {
        return handleContactIntakeCallback(callbackId, userId, payload);
    }

    if (payload.startsWith('cancel_session_') || payload.startsWith('cancel_')) {
        const sessionId = payload.replace('cancel_session_', '').replace('cancel_', '');
        const session = await db.diarySession.findUnique({
            where: { id: sessionId },
            include: { client: true, psychologist: { include: { psychologistSettings: true } } }
        });
        if (!session || session.client.maxChatId !== mid) {
            await maxApi(`/answers/${callbackId}`, {});
            return sendMaxMessage(userId, 'Сессия не найдена или у вас нет доступа.');
        }

        const policy = canClientCancel(session, session.psychologist.psychologistSettings);
        if (!policy.allowed) {
            const message = clientCancelBlockedMessage(policy.limitHours);
            await createNotification({
                psychologistId: session.psychologistId,
                type: 'client_cancel_attempt',
                title: `${session.client.name} пытался(ась) отменить сессию`,
                subtitle: message,
                sessionId: session.id,
                clientId: session.clientId,
            });
            await maxApi(`/answers/${callbackId}`, {});
            return sendMaxMessage(userId, message);
        }

        await db.diarySession.update({ where: { id: sessionId }, data: { status: 'cancelled' } });
        autoDeleteSessionFromCalendars(session.psychologistId, session.id).catch(console.error);
        await sendMaxMessage(userId, `Сессия отменена.\n\nДата: ${format(session.date, 'dd.MM.yyyy')} в ${session.time}`);

        const psyMaxId = (session.psychologist as any)?.maxChatId;
        if (psyMaxId) await sendMaxMessage(psyMaxId, `Клиент ${session.client.name} отменил сессию ${format(session.date, 'dd.MM.yyyy')} в ${session.time}.`);
        await createNotification({
            psychologistId: session.psychologistId,
            type: 'session_cancelled',
            title: `${session.client.name} отменил(а) сессию`,
            subtitle: `${format(session.date, 'dd.MM.yyyy')} в ${session.time}`,
            sessionId: session.id,
            clientId: session.clientId,
        });
    }

    else if (payload.startsWith('confirm_session_')) {
        const sessionId = payload.replace('confirm_session_', '');
        const session = await db.diarySession.findUnique({ where: { id: sessionId }, include: { client: true, psychologist: true } });
        if (!session || session.client.maxChatId !== mid) {
            await maxApi(`/answers/${callbackId}`, {});
            return sendMaxMessage(userId, 'Сессия не найдена или у вас нет доступа.');
        }
        if (session.status !== 'cancelled') await db.diarySession.update({ where: { id: session.id }, data: { status: 'confirmed' } });
        const formatText = session.format === 'offline' ? 'Очно' : 'Онлайн';
        await sendMaxMessage(userId, `Отлично, ждём вас!\n\n${format(session.date, 'dd.MM.yyyy')} в ${session.time}\n${formatText}`);
        const psyMaxId = (session.psychologist as any)?.maxChatId;
        if (psyMaxId) await sendMaxMessage(psyMaxId, `Клиент ${session.client.name} подтвердил сессию ${format(session.date, 'dd.MM.yyyy')} в ${session.time}.`);
        await createNotification({
            psychologistId: session.psychologistId,
            type: 'session_confirmed',
            title: `${session.client.name} подтвердил(а) сессию`,
            subtitle: `${format(session.date, 'dd.MM.yyyy')} в ${session.time}`,
            sessionId: session.id,
            clientId: session.clientId,
        });
    }

    else if (payload.startsWith('reschedule_session_')) {
        const sessionId = payload.replace('reschedule_session_', '');
        const session = await db.diarySession.findUnique({ where: { id: sessionId }, include: { client: true } });
        if (!session || session.client.maxChatId !== mid) {
            await maxApi(`/answers/${callbackId}`, {});
            return sendMaxMessage(userId, 'Сессия не найдена или у вас нет доступа.');
        }
        const token = sessionActionToken(session.psychologistId, session.clientId, session.id, 'reschedule', sessionActionTokenExpiry(session.date));
        const rescheduleUrl = `${APP_URL}/client/reschedule/${session.id}?t=${token}`;
        await sendMaxMessage(userId, 'Чтобы перенести сессию, выберите новое время:', [[{ text: 'Выбрать новое время', url: rescheduleUrl }]]);
    }

    else if (payload.startsWith('mood_')) {
        const parts = payload.split('_');
        const rating = parseInt(parts[1]);
        const sessionId = parts.slice(2).join('_');
        try {
            await db.diarySession.update({ where: { id: sessionId }, data: { clientMoodRating: rating } as any });
            // Оценка называется словом, а не смайликом: так видно, что записано.
    const moodWords: Record<number, string> = { 1: 'Отлично', 2: 'Хорошо', 3: 'Нормально', 4: 'Так себе', 5: 'Плохо' };
            await sendMaxMessage(userId, `Спасибо за обратную связь! Записано: ${moodWords[rating] || 'ваш ответ'}.`);
        } catch (e) {
            console.error('[MAX Bot] mood callback error:', e);
            await sendMaxMessage(userId, 'Спасибо! (не удалось сохранить ответ)');
        }
    }

    await maxApi(`/answers/${callbackId}`, {});
}

export async function handleMaxUpdate(update: MaxUpdate) {
    if (!MAX_TOKEN) return;
    try {
        if (update.update_type === 'bot_started') {
            const userId = update.user?.user_id ?? update.message?.sender?.user_id;
            if (!userId) return;
            const payload =
                (update as any).payload ||
                (update as any).start_payload ||
                update.message?.body?.text?.replace('/start ', '').trim() ||
                undefined;
            await handleStart(userId, payload);
        }

        if (update.update_type === 'message_created' && update.message) {
            const userId = update.message.sender.user_id;

            // Запоминаем диалог до разбора самого сообщения: чем бы оно ни
            // оказалось, идентификатор диалога в нём уже есть.
            await rememberMaxDialog(userId, update.message.recipient?.chat_id);

            // Контакт разбираем до текста: у сообщения с вложением текста
            // обычно нет вовсе, и оно ушло бы в меню-заглушку.
            const contact = update.message.body.attachments?.find((a) => a.type === 'contact');
            if (contact?.payload) {
                await handleContactShared(userId, contact.payload);
                return;
            }

            const text = update.message.body.text?.trim() || '';
            if (text === '/start' || text.startsWith('/start ')) {
                const param = text.split(' ')[1];
                await handleStart(userId, param);
            } else if (text === '/connect') {
                await handleConnect(userId);
            } else if (text === '/sessions' || text === '/сессии') {
                await handleSessions(userId);
            } else if (text === '/help' || text === '/помощь' || text === 'Помощь') {
                await handleHelp(userId);
            } else if (text === '/link' || text === '/ссылка' || text === 'Ссылка на запись' || text === '🔗 Ссылка на запись') {
                await handleShareLink(userId);
            } else {
                const mid = maxId(userId);
                const psy = await db.user.findFirst({ where: { maxChatId: mid } });
                if (psy) {
                    await sendMaxMessage(userId, 'Выберите действие:', [
                        [{ text: 'Открыть кабинет', url: `${APP_URL}/diary` }],
                        [{ text: 'Ссылка для клиента', url: `${APP_URL}/bot/book/${psy.id}` }],
                        [{ text: 'Мои сессии', payload: '/sessions' }],
                    ]);
                } else {
                    await sendMaxMessage(userId, 'Используйте команды:\n/start — начало\n/sessions — мои сессии\n/help — помощь', [[{ text: 'Открыть ПРАКТИКУ', url: `${APP_URL}/diary` }]]);
                }
            }
        }

        if (update.update_type === 'message_callback' && update.callback) {
            await handleCallback(update.callback.callback_id, update.callback.user.user_id, update.callback.payload);
        }
    } catch (e) {
        console.error('[MAX Bot] handleMaxUpdate error:', e);
    }
}
