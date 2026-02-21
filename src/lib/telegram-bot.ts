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
                                        web_app: { url: `${TELEGRAM_APP_URL}/bot/book/${psychologistId}` }
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

            // Create 3 smart inline results
            const results = [];

            // 1. Прямая ссылка на онлайн-запись (Бронирование)
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
                    inline_keyboard: [
                        [
                            {
                                text: '📅 Записаться',
                                url: `${TELEGRAM_APP_URL}/bot/book/${psy.id}`
                            }
                        ]
                    ]
                }
            });

            // 2. Выбрать время в календаре (через интерфейс Telegram Mini App)
            results.push({
                type: 'article',
                id: 'miniapp_calendar',
                title: '📅 Выбрать время через Telegram',
                description: 'Отправит карточку с кнопкой, открывающей календарь внутри Telegram',
                input_message_content: {
                    message_text: `👋 Привет! Чтобы выбрать удобное время для сессии, нажми на кнопку ниже. Откроется календарь прямо здесь, в Telegram.`,
                },
                reply_markup: {
                    inline_keyboard: [
                        [
                            {
                                text: '📅 Выбрать время',
                                url: `https://t.me/CompasProBot?start=psy_${psy.id}`
                            }
                        ]
                    ]
                }
            });

            // 3. Ближайшее свободное окно (если есть слоты)
            if (slots.length > 0) {
                // Find the soonest slot. Assuming slots are partially sorted, or just take the first one for simplicity for now.
                // In a perfect world, we'd calculate the exact next occurrence of the dayOfWeek.
                const nextSlot = slots[0];
                const dayLabels = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];

                results.push({
                    type: 'article',
                    id: 'nearest_slot',
                    title: `⚡️ Пригласить на ближайшее окно: ${dayLabels[nextSlot.dayOfWeek]} в ${nextSlot.startTime}`,
                    description: `Длительность: ${nextSlot.duration} мин`,
                    input_message_content: {
                        message_text: `👋 Привет! У меня появилось свободное окно для сессии: *${dayLabels[nextSlot.dayOfWeek]} в ${nextSlot.startTime}*.\n\nНажми на кнопку ниже, чтобы занять его!`,
                        parse_mode: 'Markdown'
                    },
                    reply_markup: {
                        inline_keyboard: [
                            [
                                {
                                    text: 'Занять это время',
                                    url: `https://t.me/CompasProBot?start=psy_${psy.id}`
                                }
                            ]
                        ]
                    }
                });
            }

            // Reverse to show Nearest Slot first if it exists
            await ctx.answerInlineQuery(results.reverse() as any, { cache_time: 0 });

        } catch (error) {
            console.error('Inline query error:', error);
        }
    });
}

// Ensure the bot is set up when the module is imported
setupBot();
