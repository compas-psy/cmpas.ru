import { Telegraf, Context } from 'telegraf';
import { db } from '@/lib/db';

const TELEGRAM_APP_URL = process.env.AUTH_URL || 'https://cmpas.ru';
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

if (!BOT_TOKEN) {
    if (process.env.NODE_ENV !== 'development') {
        console.warn('TELEGRAM_BOT_TOKEN is not set. Bot functional features will be disabled.');
    }
}

export const bot = BOT_TOKEN ? new Telegraf(BOT_TOKEN) : null;

/**
 * Initializes bot commands and listeners
 */
export function setupBot() {
    if (!bot) return;

    // Command: /start
    bot.start(async (ctx: Context) => {
        const payload = (ctx as any).message?.text?.split(' ')[1]; // e.g. /start psy_123

        const keyboard = {
            inline_keyboard: [
                [
                    {
                        text: '💼 Войти в кабинет (для психолога)',
                        web_app: { url: `${TELEGRAM_APP_URL}/diary/bot` }
                    }
                ]
            ]
        };

        if (payload?.startsWith('psy_')) {
            // Client Flow: Came via booking link
            const psychologistId = payload.replace('psy_', '');

            // Try to look up the psychologist to personalize the greeting
            try {
                const psy = await db.user.findUnique({
                    where: { id: psychologistId },
                    select: { name: true }
                });

                if (psy) {
                    await ctx.reply(`Добро пожаловать к психологу ${psy.name || 'Специалист'}!\n\nНажмите кнопку ниже, чтобы выбрать удобное время для сессии.`, {
                        reply_markup: {
                            inline_keyboard: [
                                [
                                    {
                                        text: '📅 Записаться на сессию',
                                        web_app: { url: `${TELEGRAM_APP_URL}/diary/bot/book/${psychologistId}` }
                                    }
                                ]
                            ]
                        }
                    });
                    return;
                }
            } catch (err) {
                console.error('Error fetching psychologist:', err);
            }
        }

        // Default greeting (mostly for Psychologists)
        await ctx.reply(
            'Добро пожаловать в Compas.ru!\n\nЕсли вы психолог — нажмите кнопку ниже, чтобы привязать свой аккаунт и получать уведомления.',
            { reply_markup: keyboard }
        );
    });

    // Inline Query Handler
    bot.on('inline_query', async (ctx) => {
        try {
            const userId = ctx.from.id.toString();

            // Find psychologist linked to this Telegram user
            const psy = await db.user.findFirst({
                where: { telegramChatId: userId } // We use chatId/userId interchangeably here for PMs
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

            // Fetch upcoming availability slots
            // Simplified logic: finding all slots. Ideally we'd expand recurring slots into actual dates.
            const slots = await db.availabilitySlot.findMany({
                where: { psychologistId: psy.id, isActive: true },
                take: 5
            });

            if (slots.length === 0) {
                await ctx.answerInlineQuery([{
                    type: 'article',
                    id: 'no_slots',
                    title: 'Нет свободных окон',
                    input_message_content: {
                        message_text: 'К сожалению, у меня пока нет добавленных свободных окон в расписании.'
                    }
                }]);
                return;
            }

            // Create inline results
            const results = slots.map(slot => {
                const dayLabels = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
                const title = `Окно: ${dayLabels[slot.dayOfWeek]} в ${slot.startTime}`;
                const description = `Длительность: ${slot.duration} мин`;

                return {
                    type: 'article',
                    id: slot.id,
                    title: title,
                    description: description,
                    input_message_content: {
                        message_text: `👋 Привет! Я открыл окно для записи: *${dayLabels[slot.dayOfWeek]} в ${slot.startTime}*\n\nНажмите кнопку ниже, чтобы забронировать это время.`,
                        parse_mode: 'Markdown'
                    },
                    reply_markup: {
                        inline_keyboard: [
                            [
                                {
                                    text: 'Записаться',
                                    url: `https://t.me/cmpas_bot?start=psy_${psy.id}`
                                }
                            ]
                        ]
                    }
                };
            });

            await ctx.answerInlineQuery(results as any, { cache_time: 0 });

        } catch (error) {
            console.error('Inline query error:', error);
        }
    });
}

// Ensure the bot is set up when the module is imported
setupBot();
