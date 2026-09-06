import { Telegraf, Context, Markup } from 'telegraf';
import type { Agent } from 'http';
import { db } from '@/lib/db';
import { format } from 'date-fns';
import { consumeClientChannelInvite } from '@/lib/channel-binding';
import { createNotification } from '@/lib/notifications';
import { telegramSendAgent } from '@/lib/telegram-proxy';
import { autoDeleteSessionFromCalendars } from '@/lib/calendar/auto-sync';
import { canClientCancel, clientCancelBlockedMessage } from '@/lib/client-cancellation';
import { sessionActionToken, sessionActionTokenExpiry, personalClientToken } from '@/lib/client-workflow';

const TELEGRAM_APP_URL = process.env.AUTH_URL || 'https://cmpas.ru';
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_PROXY = process.env.TELEGRAM_PROXY;

if (!BOT_TOKEN && process.env.NODE_ENV !== 'development') {
    console.warn('TELEGRAM_BOT_TOKEN is not set. Bot functional features will be disabled.');
}

const TELEGRAM_API_URL = process.env.TELEGRAM_API_URL || 'https://api.telegram.org';

function createBot() {
    if (!BOT_TOKEN) return null;
    try {
        const opts: any = { telegram: { apiRoot: TELEGRAM_API_URL } };
        console.log(`[TG Bot] API root: ${TELEGRAM_API_URL}`);
        return new Telegraf(BOT_TOKEN, opts);
    } catch (e) {
        console.error('[TG Bot] Failed to create Telegraf:', e);
        return null;
    }
}

export const bot = createBot();

if (bot && TELEGRAM_PROXY) {
    const syncProxyState = async () => {
        try {
            const desired = (await telegramSendAgent()) as Agent | undefined;
            if (bot.telegram.options.agent !== desired) {
                bot.telegram.options.agent = desired;
                console.log(`[TG Bot] VPN proxy ${desired ? 'active' : 'bypassed (direct)'}`);
            }
        } catch (e) {
            console.error('[TG Bot] Failed to sync VPN proxy flag:', e);
        }
    };
    syncProxyState();
    setInterval(syncProxyState, 20_000);
}

async function showPsyMenu(ctx: Context, psy: any) {
    await ctx.reply(`Добро пожаловать в кабинет психолога, ${psy.name || 'Специалист'}!`,
        Markup.keyboard([
            ['💼 Мой кабинет', '🗓 Мои сессии'],
            ['🔗 Отправить ссылку на запись']
        ]).resize()
    );
}

async function showClientMenu(ctx: Context, psychologistId: string, clientName: string = 'Клиент', clientId?: string) {
    const bookUrl = clientId
        ? `${TELEGRAM_APP_URL}/bot/book/${psychologistId}?c=${personalClientToken(clientId)}&v=${Date.now()}`
        : `${TELEGRAM_APP_URL}/bot/book/${psychologistId}?v=${Date.now()}`;

    await ctx.reply(`Добро пожаловать, ${clientName}!\nИспользуйте меню для управления записями.`,
        Markup.keyboard([
            [Markup.button.webApp('📅 Записаться', bookUrl)],
            [Markup.button.webApp('🗓 Мои сессии', `${TELEGRAM_APP_URL}/bot/client?v=${Date.now()}`)]
        ]).resize()
    );
}

export function setupBot() {
    if (!bot) return;

    bot.command('connect', async (ctx: Context) => {
        const tgId = ctx.from?.id.toString();
        if (!tgId) return;

        const psy = await db.user.findUnique({ where: { telegramChatId: tgId } });
        if (psy) {
            return ctx.reply(
                '✅ Ваш Telegram уже привязан к ПРАКТИКЕ.\n\nЧтобы также подключить MAX мессенджер — откройте страницу интеграций.',
                Markup.inlineKeyboard([[Markup.button.webApp('⚙️ Интеграции', `${TELEGRAM_APP_URL}/diary/integrations`)]])
            );
        }

        await ctx.reply(
            'Чтобы привязать аккаунт психолога, войдите в кабинет:',
            Markup.inlineKeyboard([[Markup.button.webApp('💼 Войти в кабинет', `${TELEGRAM_APP_URL}/diary/bot`)]])
        );
    });

    bot.start(async (ctx: Context) => {
        const payload = (ctx as any).message?.text?.split(' ')[1];
        const tgId = ctx.from?.id.toString();
        if (!tgId) return;

        const psy = await db.user.findUnique({ where: { telegramChatId: tgId } });
        if (psy) return showPsyMenu(ctx, psy);

        if (payload?.startsWith('c_')) {
            const token = payload.slice(2);
            try {
                const client = await consumeClientChannelInvite({
                    token,
                    channel: 'telegram',
                    providerUserId: tgId,
                    providerChatId: tgId,
                    username: ctx.from?.username || null,
                });

                await ctx.reply(`Привет, ${client.name}! 👋\n\nВаш аккаунт успешно привязан к специалисту. Теперь вы будете получать уведомления о встречах здесь.`);

                try {
                    const queued = await db.scheduledClientMessage.findMany({
                        where: { clientId: client.id, channel: 'telegram', status: 'pending' },
                        orderBy: { createdAt: 'asc' },
                    });
                    for (const m of queued) {
                        try {
                            await ctx.telegram.sendMessage(tgId, m.text, { parse_mode: 'HTML', link_preview_options: { is_disabled: true } });
                            await db.scheduledClientMessage.update({ where: { id: m.id }, data: { status: 'sent', sentAt: new Date() } });
                        } catch (e) {
                            console.error('[telegram-bot] queued onboarding delivery failed:', e);
                        }
                    }
                } catch (e) {
                    console.error('[telegram-bot] queued onboarding lookup failed:', e);
                }
                return;
            } catch (e) {
                const code = e instanceof Error ? e.message : '';
                const message = code === 'INVITE_ALREADY_USED'
                    ? 'Эта ссылка уже была использована. Попросите специалиста отправить новую.'
                    : code === 'INVITE_EXPIRED'
                        ? 'Срок действия ссылки истёк. Попросите специалиста отправить новую.'
                        : 'Ссылка недействительна. Попросите специалиста отправить новую.';
                await ctx.reply(message);
                return;
            }
        }

        if (payload?.startsWith('psy_')) {
            let psychologistId = payload.replace('psy_', '');
            let linkClientId: string | undefined;
            if (psychologistId.includes('_c_')) {
                const parts = psychologistId.split('_c_');
                psychologistId = parts[0];
                linkClientId = parts[1];
            }

            const targetPsy = await db.user.findUnique({
                where: { id: psychologistId },
                select: { name: true, psychologistSettings: { select: { fullName: true } } }
            });

            if (targetPsy) {
                const psyName = targetPsy.psychologistSettings?.fullName || targetPsy.name || 'Специалист';
                const existingTgClient = await db.telegramClient.findUnique({ where: { telegramUserId: tgId } });
                await db.telegramClient.upsert({
                    where: { telegramUserId: tgId },
                    update: { psychologistId, diaryClientId: existingTgClient?.diaryClientId || linkClientId || null },
                    create: { telegramUserId: tgId, psychologistId, telegramUsername: ctx.from?.username, diaryClientId: linkClientId || null }
                });
                return showClientMenu(ctx, psychologistId, psyName, linkClientId || existingTgClient?.diaryClientId || undefined);
            }
        }

        const client = await db.diaryClient.findFirst({ where: { telegramChatId: tgId }, include: { psychologist: true } });
        if (client) return showClientMenu(ctx, client.psychologistId, client.name, client.id);

        const tgClient = await db.telegramClient.findUnique({ where: { telegramUserId: tgId } });
        if (tgClient && tgClient.psychologistId) return showClientMenu(ctx, tgClient.psychologistId, tgClient.fullName || 'Клиент', tgClient.diaryClientId || undefined);

        await ctx.reply(
            'Добро пожаловать в Compas.ru!\n\nЕсли вы психолог — нажмите кнопку ниже, чтобы привязать свой аккаунт и получать уведомления.',
            Markup.inlineKeyboard([[Markup.button.webApp('💼 Войти в кабинет', `${TELEGRAM_APP_URL}/diary/bot?v=${Date.now()}`)]])
        );
    });

    bot.hears('💼 Мой кабинет', async (ctx) => {
        await ctx.reply('Нажмите на кнопку ниже, чтобы перейти в свой кабинет:',
            Markup.inlineKeyboard([[Markup.button.webApp('Открыть кабинет', `${TELEGRAM_APP_URL}/diary?v=${Date.now()}`)]])
        );
    });

    bot.hears('🔗 Отправить ссылку на запись', async (ctx) => {
        const tgId = ctx.from?.id.toString();
        const psy = await db.user.findUnique({ where: { telegramChatId: tgId } });
        if (!psy) return;
        await ctx.reply('Перешлите это сообщение вашему клиенту:',
            Markup.inlineKeyboard([[Markup.button.url('📅 Записаться', `${TELEGRAM_APP_URL}/bot/book/${psy.id}?v=${Date.now()}`)]])
        );
    });

    bot.hears('🗓 Мои сессии', async (ctx) => {
        const tgId = ctx.from?.id.toString();
        if (!tgId) return;

        const psy = await db.user.findUnique({ where: { telegramChatId: tgId } });
        if (psy) {
            const sessions = await db.diarySession.findMany({
                where: { psychologistId: psy.id, status: 'confirmed', date: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } },
                orderBy: [{ date: 'asc' }, { time: 'asc' }],
                take: 5,
                include: { client: true }
            });
            if (sessions.length === 0) return ctx.reply('У вас нет предстоящих подтвержденных сессий.');
            let msg = '📅 <b>Ваши ближайшие сессии:</b>\n\n';
            sessions.forEach(s => {
                msg += `👤 <b>${s.client.name}</b>\n⏰ ${format(s.date, 'dd.MM.yyyy')} в ${s.time}\n📍 ${s.format === 'offline' ? 'Очно' : 'Онлайн'}\n\n`;
            });
            return ctx.reply(msg, { parse_mode: 'HTML' });
        }

        const client = await db.diaryClient.findFirst({ where: { telegramChatId: tgId } });
        if (client) {
            const sessions = await db.diarySession.findMany({
                where: { clientId: client.id, status: 'confirmed', date: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } },
                orderBy: [{ date: 'asc' }, { time: 'asc' }],
                include: { psychologist: true }
            });
            if (sessions.length === 0) return ctx.reply('У вас нет предстоящих записей.');
            for (const s of sessions) {
                const bookUrl = `${TELEGRAM_APP_URL}/bot/book/${s.psychologistId}?c=${personalClientToken(s.clientId)}&v=${Date.now()}`;
                const msg = `📅 <b>Сессия с психологом ${s.psychologist.name}</b>\n\n⏰ Дата: ${format(s.date, 'dd.MM.yyyy')} в ${s.time}\n📍 Формат: ${s.format === 'offline' ? 'Очно' : 'Онлайн'}`;
                await ctx.reply(msg, {
                    parse_mode: 'HTML',
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: '🔄 Перенести (Новая запись)', web_app: { url: bookUrl } }],
                            [{ text: '❌ Отменить', callback_data: `cancel_${s.id}` }]
                        ]
                    }
                });
            }
            return;
        }

        await ctx.reply('Аккаунт не найден. Выберите "Записаться" по прямой ссылке от вашего психолога.');
    });

    bot.action(/cancel_(.+)/, async (ctx) => {
        const sessionId = ctx.match[1];
        const tgId = ctx.from?.id.toString();
        const session = await db.diarySession.findUnique({
            where: { id: sessionId },
            include: { client: true, psychologist: { include: { psychologistSettings: true } } }
        });

        if (!session || session.client.telegramChatId !== tgId) {
            return ctx.answerCbQuery('Сессия не найдена или у вас нет доступа.', { show_alert: true });
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
            await ctx.answerCbQuery('Отмена уже недоступна', { show_alert: true });
            return ctx.reply(message);
        }

        await db.diarySession.update({ where: { id: sessionId }, data: { status: 'cancelled' } });
        autoDeleteSessionFromCalendars(session.psychologistId, session.id).catch(console.error);

        await ctx.editMessageText(`❌ Сессия отменена.\n\nДата: ${format(session.date, 'dd.MM.yyyy')} в ${session.time}`);
        await ctx.answerCbQuery('Вы успешно отменили запись');

        if (session.psychologist.telegramChatId) {
            try {
                await ctx.telegram.sendMessage(session.psychologist.telegramChatId, `⚠️ <b>Отмена записи</b>\n\nКлиент ${session.client.name} отменил сессию на ${format(session.date, 'dd.MM.yyyy')} в ${session.time}.`, { parse_mode: 'HTML' });
            } catch (e) { }
        }
        await createNotification({
            psychologistId: session.psychologistId,
            type: 'session_cancelled',
            title: `${session.client.name} отменил(а) сессию`,
            subtitle: `${format(session.date, 'dd.MM.yyyy')} в ${session.time}`,
            sessionId: session.id,
            clientId: session.clientId,
        });
    });

    bot.action(/confirm_session_(.+)/, async (ctx) => {
        const sessionId = ctx.match[1];
        const tgId = ctx.from?.id.toString();
        const session = await db.diarySession.findUnique({ where: { id: sessionId }, include: { client: true, psychologist: true } });
        if (!session || session.client.telegramChatId !== tgId) return ctx.answerCbQuery('Сессия не найдена.', { show_alert: true });

        if (session.status !== 'cancelled') {
            await db.diarySession.update({ where: { id: session.id }, data: { status: 'confirmed' } });
        }
        await ctx.editMessageText(`✅ Отлично, ждём вас!\n\n📅 ${format(session.date, 'dd.MM.yyyy')} в ${session.time}\n📍 ${session.format === 'offline' ? 'Очно' : 'Онлайн'}`);
        await ctx.answerCbQuery('Спасибо за подтверждение!');

        if (session.psychologist.telegramChatId) {
            try {
                await ctx.telegram.sendMessage(session.psychologist.telegramChatId, `✅ Клиент ${session.client.name} подтвердил сессию на ${format(session.date, 'dd.MM.yyyy')} в ${session.time}.`, { parse_mode: 'HTML' });
            } catch (e) { }
        }
        await createNotification({
            psychologistId: session.psychologistId,
            type: 'session_confirmed',
            title: `${session.client.name} подтвердил(а) сессию`,
            subtitle: `${format(session.date, 'dd.MM.yyyy')} в ${session.time}`,
            sessionId: session.id,
            clientId: session.clientId,
        });
    });

    bot.action(/reschedule_session_(.+)/, async (ctx) => {
        const sessionId = ctx.match[1];
        const tgId = ctx.from?.id.toString();
        const session = await db.diarySession.findUnique({ where: { id: sessionId }, include: { client: true } });
        if (!session || session.client.telegramChatId !== tgId) return ctx.answerCbQuery('Сессия не найдена.', { show_alert: true });
        const token = sessionActionToken(session.psychologistId, session.clientId, session.id, 'reschedule', sessionActionTokenExpiry(session.date));
        const rescheduleUrl = `${TELEGRAM_APP_URL}/client/reschedule/${session.id}?t=${token}`;
        await ctx.editMessageText('🔄 Чтобы перенести сессию, выберите новое время:', {
            reply_markup: { inline_keyboard: [[{ text: '📅 Выбрать новое время', web_app: { url: rescheduleUrl } }]] }
        });
        await ctx.answerCbQuery();
    });

    bot.action(/mood_(\d+)_(.+)/, async (ctx) => {
        const rating = parseInt(ctx.match[1]);
        const sessionId = ctx.match[2];
        try {
            await db.diarySession.update({ where: { id: sessionId }, data: { clientMoodRating: rating } as any });
        } catch (e) { console.error('[mood callback]', e); }
        const emojis = ['', '😊', '🙂', '😐', '😔', '😢'];
        await ctx.editMessageText(`${emojis[rating] || '✅'} Спасибо за обратную связь! Ваша оценка сохранена.`);
        await ctx.answerCbQuery();
    });

    bot.on('inline_query', async (ctx) => {
        try {
            const userId = ctx.from.id.toString();
            const psy = await db.user.findFirst({ where: { telegramChatId: userId } });
            if (!psy) {
                await ctx.answerInlineQuery([], { button: { text: 'Привязать аккаунт психолога', start_parameter: 'connect' } });
                return;
            }

            const slots = await db.availabilitySlot.findMany({ where: { psychologistId: psy.id, isActive: true }, take: 5 });
            if (slots.length === 0) {
                await ctx.answerInlineQuery([{
                    type: 'article',
                    id: 'no_slots',
                    title: 'Нет свободных окон',
                    input_message_content: { message_text: 'К сожалению, у меня пока нет добавленных свободных окон в расписании.' }
                }]);
                return;
            }

            const query = ctx.inlineQuery.query.trim();
            let matchedClient = null;
            if (query.length >= 2) {
                matchedClient = await db.diaryClient.findFirst({ where: { psychologistId: psy.id, name: { contains: query, mode: 'insensitive' } } });
            }

            const clientToken = matchedClient ? personalClientToken(matchedClient.id) : null;
            const clientQueryParam = clientToken ? `?c=${clientToken}` : '';
            const clientQueryParamWithV = clientToken ? `?c=${clientToken}&v=${Date.now()}` : `?v=${Date.now()}`;
            const linkParam = matchedClient ? `psy_${psy.id}_c_${matchedClient.id}` : `psy_${psy.id}`;
            const results: any[] = [];

            results.push({
                type: 'article',
                id: 'booking_link',
                title: matchedClient ? `🔗 Отправить ссылку клиенту: ${matchedClient.name}` : '🔗 Отправить ссылку на запись',
                description: 'Клиент получит ссылку для самостоятельного выбора времени',
                input_message_content: {
                    message_text: `👋 Привет! Записаться ко мне на консультацию можно по ссылке ниже:\n\n[Выбрать время и записаться](${TELEGRAM_APP_URL}/bot/book/${psy.id}${clientQueryParam})`,
                    parse_mode: 'Markdown'
                },
                reply_markup: { inline_keyboard: [[{ text: '📅 Записаться', url: `${TELEGRAM_APP_URL}/bot/book/${psy.id}${clientQueryParamWithV}` }]] }
            });

            results.push({
                type: 'article',
                id: 'miniapp_calendar',
                title: matchedClient ? `📅 Выбрать время через Telegram (для ${matchedClient.name})` : '📅 Выбрать время через Telegram',
                description: 'Отправит карточку с кнопкой, открывающей календарь внутри Telegram',
                input_message_content: { message_text: '👋 Привет! Чтобы выбрать удобное время для сессии, нажми на кнопку ниже. Откроется календарь прямо здесь, в Telegram.' },
                reply_markup: { inline_keyboard: [[{ text: '📅 Выбрать время', url: `https://t.me/CompasProBot?start=${linkParam}` }]] }
            });

            if (slots.length > 0) {
                const nextSlot = slots[0];
                const dayLabels = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
                results.push({
                    type: 'article',
                    id: 'nearest_slot',
                    title: `⚡️ Пригласить на окно: ${dayLabels[nextSlot.dayOfWeek]} в ${nextSlot.startTime}`,
                    description: `Длительность: ${nextSlot.duration} мин`,
                    input_message_content: {
                        message_text: `👋 Привет! У меня появилось свободное окно для сессии: *${dayLabels[nextSlot.dayOfWeek]} в ${nextSlot.startTime}*.\n\nНажми на кнопку ниже, чтобы занять его!`,
                        parse_mode: 'Markdown'
                    },
                    reply_markup: { inline_keyboard: [[{ text: 'Занять это время', url: `https://t.me/CompasProBot?start=${linkParam}` }]] }
                });
            }

            await ctx.answerInlineQuery(results.reverse() as any, { cache_time: 0 });
        } catch (error) {
            console.error('Inline query error:', error);
        }
    });
}

setupBot();
