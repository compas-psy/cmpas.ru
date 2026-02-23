import { Telegraf, Context, Markup } from 'telegraf';
import { db } from '@/lib/db';
import { format } from 'date-fns';

const TELEGRAM_APP_URL = process.env.AUTH_URL || 'https://cmpas.ru';
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

if (!BOT_TOKEN) {
    if (process.env.NODE_ENV !== 'development') {
        console.warn('TELEGRAM_BOT_TOKEN is not set. Bot functional features will be disabled.');
    }
}

export const bot = BOT_TOKEN ? new Telegraf(BOT_TOKEN) : null;

async function showPsyMenu(ctx: Context, psy: any) {
    await ctx.reply(`Добро пожаловать в кабинет психолога, ${psy.name || 'Специалист'}!`,
        Markup.keyboard([
            ['💼 Мой кабинет', '🗓 Мои сессии'],
            ['🔗 Отправить ссылку на запись']
        ]).resize()
    );
}

async function showClientMenu(ctx: Context, psychologistId: string, clientName: string = 'Клиент') {
    await ctx.reply(`Добро пожаловать, ${clientName}!\nИспользуйте меню для управления записями.`,
        Markup.keyboard([
            [Markup.button.webApp('📅 Записаться', `${TELEGRAM_APP_URL}/bot/book/${psychologistId}?v=${Date.now()}`)],
            ['🗓 Мои сессии']
        ]).resize()
    );
}

/**
 * Initializes bot commands and listeners
 */
export function setupBot() {
    if (!bot) return;

    // Command: /start
    bot.start(async (ctx: Context) => {
        const payload = (ctx as any).message?.text?.split(' ')[1]; // e.g. /start psy_123
        const tgId = ctx.from?.id.toString();
        if (!tgId) return;

        // 1. Check if Psychologist
        const psy = await db.user.findUnique({ where: { telegramChatId: tgId } });
        if (psy) {
            return showPsyMenu(ctx, psy);
        }

        // 2. Check if Client coming directly from booking link
        if (payload?.startsWith('psy_')) {
            const psychologistId = payload.replace('psy_', '');

            const targetPsy = await db.user.findUnique({ where: { id: psychologistId }, select: { name: true } });

            if (targetPsy) {
                // Save them temporarily as TelegramClient so we know their psychologist
                await db.telegramClient.upsert({
                    where: { telegramUserId: tgId },
                    update: { psychologistId },
                    create: { telegramUserId: tgId, psychologistId, telegramUsername: ctx.from?.username }
                });

                return showClientMenu(ctx, psychologistId);
            }
        }

        // 3. Check if existing DiaryClient or TelegramClient
        const client = await db.diaryClient.findFirst({
            where: { telegramChatId: tgId },
            include: { psychologist: true }
        });
        if (client) {
            return showClientMenu(ctx, client.psychologistId, client.name);
        }

        const tgClient = await db.telegramClient.findUnique({ where: { telegramUserId: tgId } });
        if (tgClient && tgClient.psychologistId) {
            return showClientMenu(ctx, tgClient.psychologistId);
        }

        // 4. Default greeting (Unregistered/Unknown)
        await ctx.reply(
            'Добро пожаловать в Compas.ru!\n\nЕсли вы психолог — нажмите кнопку ниже, чтобы привязать свой аккаунт и получать уведомления.',
            Markup.inlineKeyboard([
                [Markup.button.webApp('💼 Войти в кабинет', `${TELEGRAM_APP_URL}/diary/bot?v=${Date.now()}`)]
            ])
        );
    });

    // Psychologist Actions
    bot.hears('💼 Мой кабинет', async (ctx) => {
        await ctx.reply('Нажмите на кнопку ниже, чтобы перейти в свой кабинет:',
            Markup.inlineKeyboard([
                [Markup.button.webApp('Открыть кабинет', `${TELEGRAM_APP_URL}/diary?v=${Date.now()}`)]
            ])
        );
    });

    bot.hears('🔗 Отправить ссылку на запись', async (ctx) => {
        const tgId = ctx.from?.id.toString();
        const psy = await db.user.findUnique({ where: { telegramChatId: tgId } });
        if (!psy) return;

        await ctx.reply('Перешлите это сообщение вашему клиенту:',
            Markup.inlineKeyboard([
                [Markup.button.url('📅 Записаться', `${TELEGRAM_APP_URL}/bot/book/${psy.id}?v=${Date.now()}`)]
            ])
        );
    });

    // Shared text for My Sessions (handled differently for Psy and Client)
    bot.hears('🗓 Мои сессии', async (ctx) => {
        const tgId = ctx.from?.id.toString();
        if (!tgId) return;

        // Check if Psy
        const psy = await db.user.findUnique({ where: { telegramChatId: tgId } });
        if (psy) {
            const sessions = await db.diarySession.findMany({
                where: { psychologistId: psy.id, status: 'confirmed', date: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } },
                orderBy: [{ date: 'asc' }, { time: 'asc' }],
                take: 5,
                include: { client: true }
            });

            if (sessions.length === 0) {
                return ctx.reply('У вас нет предстоящих подтвержденных сессий.');
            }

            let msg = '📅 <b>Ваши ближайшие сессии:</b>\n\n';
            sessions.forEach(s => {
                msg += `👤 <b>${s.client.name}</b>\n⏰ ${format(s.date, 'dd.MM.yyyy')} в ${s.time}\n📍 ${s.format === 'offline' ? 'Очно' : 'Онлайн'}\n\n`;
            });
            return ctx.reply(msg, { parse_mode: 'HTML' });
        }

        // Check if Client
        const client = await db.diaryClient.findFirst({ where: { telegramChatId: tgId } });
        if (client) {
            const sessions = await db.diarySession.findMany({
                where: { clientId: client.id, status: 'confirmed', date: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } },
                orderBy: [{ date: 'asc' }, { time: 'asc' }],
                include: { psychologist: true }
            });

            if (sessions.length === 0) {
                return ctx.reply('У вас нет предстоящих записей.');
            }

            for (const s of sessions) {
                const msg = `📅 <b>Сессия с психологом ${s.psychologist.name}</b>\n\n⏰ Дата: ${format(s.date, 'dd.MM.yyyy')} в ${s.time}\n📍 Формат: ${s.format === 'offline' ? 'Очно' : 'Онлайн'}`;
                await ctx.reply(msg, {
                    parse_mode: 'HTML',
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: '🔄 Перенести (Новая запись)', web_app: { url: `${TELEGRAM_APP_URL}/bot/book/${s.psychologistId}?v=${Date.now()}` } }],
                            [{ text: '❌ Отменить', callback_data: `cancel_${s.id}` }]
                        ]
                    }
                });
            }
            return;
        }

        await ctx.reply('Аккаунт не найден. Выберите "Записаться" по прямой ссылке от вашего психолога.');
    });

    // Session Cancel Callback
    bot.action(/cancel_(.+)/, async (ctx) => {
        const sessionId = ctx.match[1];
        const tgId = ctx.from?.id.toString();

        const session = await db.diarySession.findUnique({
            where: { id: sessionId },
            include: { client: true, psychologist: true }
        });

        if (!session || session.client.telegramChatId !== tgId) {
            return ctx.answerCbQuery('Сессия не найдена или у вас нет доступа.', { show_alert: true });
        }

        await db.diarySession.update({
            where: { id: sessionId },
            data: { status: 'cancelled' }
        });

        await ctx.editMessageText(`❌ Сессия отменена.\n\nДата: ${format(session.date, 'dd.MM.yyyy')} в ${session.time}`);
        await ctx.answerCbQuery('Вы успешно отменили запись');

        // Notify Psy
        if (session.psychologist.telegramChatId) {
            try {
                await ctx.telegram.sendMessage(session.psychologist.telegramChatId, `⚠️ <b>Отмена записи</b>\n\nКлиент ${session.client.name} отменил сессию на ${format(session.date, 'dd.MM.yyyy')} в ${session.time}.`, { parse_mode: 'HTML' });
            } catch (e) { }
        }
    });

    // Inline Query Handler (For Psy to send quick booking links in chats)
    bot.on('inline_query', async (ctx) => {
        try {
            const userId = ctx.from.id.toString();

            const psy = await db.user.findFirst({
                where: { telegramChatId: userId }
            });

            if (!psy) {
                await ctx.answerInlineQuery([], {
                    button: {
                        text: 'Привязать аккаунт психолога',
                        start_parameter: 'connect'
                    }
                });
                return;
            }

            const slots = await db.availabilitySlot.findMany({
                where: { psychologistId: psy.id, isActive: true },
                take: 5
            });

            if (slots.length === 0) {
                await ctx.answerInlineQuery([{
                    type: 'article',
                    id: 'no_slots',
                    title: 'Нет свободных окон',
                    input_message_content: { message_text: 'К сожалению, у меня пока нет добавленных свободных окон в расписании.' }
                }]);
                return;
            }

            const results = [];

            results.push({
                type: 'article',
                id: 'booking_link',
                title: '🔗 Отправить ссылку на запись',
                description: 'Клиент получит ссылку для самостоятельного выбора времени',
                input_message_content: {
                    message_text: `👋 Привет! Записаться ко мне на консультацию можно по ссылке ниже:\n\n[Выбрать время и записаться](${TELEGRAM_APP_URL}/bot/book/${psy.id})`,
                    parse_mode: 'Markdown'
                },
                reply_markup: {
                    inline_keyboard: [[{ text: '📅 Записаться', url: `${TELEGRAM_APP_URL}/bot/book/${psy.id}?v=${Date.now()}` }]]
                }
            });

            results.push({
                type: 'article',
                id: 'miniapp_calendar',
                title: '📅 Выбрать время через Telegram',
                description: 'Отправит карточку с кнопкой, открывающей календарь внутри Telegram',
                input_message_content: {
                    message_text: `👋 Привет! Чтобы выбрать удобное время для сессии, нажми на кнопку ниже. Откроется календарь прямо здесь, в Telegram.`,
                },
                reply_markup: {
                    inline_keyboard: [[{ text: '📅 Выбрать время', url: `https://t.me/CompasProBot?start=psy_${psy.id}` }]]
                }
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
                    reply_markup: {
                        inline_keyboard: [[{ text: 'Занять это время', url: `https://t.me/CompasProBot?start=psy_${psy.id}` }]]
                    }
                });
            }

            await ctx.answerInlineQuery(results.reverse() as any, { cache_time: 0 });

        } catch (error) {
            console.error('Inline query error:', error);
        }
    });
}

setupBot();

