/**
 * MAX Messenger Bot (mail.ru)
 * Compatible with Telegram Bot API protocol, but uses MAX API endpoint.
 * No WebApp support — only URL buttons and plain text.
 */
import { Telegraf, Context, Markup } from 'telegraf';
import { db } from '@/lib/db';
import { format } from 'date-fns';

const APP_URL = process.env.AUTH_URL || 'https://cmpas.ru';
const MAX_BOT_TOKEN = process.env.MAX_BOT_TOKEN;
const MAX_API_ROOT = 'https://botapi.max.ru';

if (!MAX_BOT_TOKEN) {
    if (process.env.NODE_ENV !== 'development') {
        console.warn('[MAX Bot] MAX_BOT_TOKEN is not set. MAX bot will be disabled.');
    }
}

export const maxBot = MAX_BOT_TOKEN
    ? new Telegraf(MAX_BOT_TOKEN, { telegram: { apiRoot: MAX_API_ROOT } })
    : null;

const MAX_PREFIX = 'max_';
/** Store MAX user ID with prefix so it doesn't collide with Telegram IDs in TelegramClient */
function maxId(id: string | number) {
    return `${MAX_PREFIX}${id}`;
}

async function showPsyMenu(ctx: Context, psy: any) {
    await ctx.reply(
        `Добро пожаловать в кабинет специалиста, ${psy.name || 'Специалист'}!\n\nИспользуйте кнопки ниже для управления:`,
        Markup.inlineKeyboard([
            [Markup.button.url('💼 Открыть кабинет', `${APP_URL}/diary`)],
            [Markup.button.url('🔗 Ссылка на запись', `${APP_URL}/bot/book/${psy.id}`)],
        ])
    );
}

async function showClientMenu(ctx: Context, psychologistId: string, clientName = 'Клиент', clientId?: string) {
    const bookUrl = clientId
        ? `${APP_URL}/bot/book/${psychologistId}?c=${clientId}`
        : `${APP_URL}/bot/book/${psychologistId}`;

    await ctx.reply(
        `Добро пожаловать, ${clientName}!\nЧтобы записаться или посмотреть сессии — воспользуйтесь ссылками ниже.`,
        Markup.inlineKeyboard([
            [Markup.button.url('📅 Записаться', bookUrl)],
            [Markup.button.url('🗓 Мои сессии', `${APP_URL}/bot/client`)],
        ])
    );
}

export function setupMaxBot() {
    if (!maxBot) return;

    // /start — entry point
    maxBot.start(async (ctx: Context) => {
        const payload = (ctx as any).message?.text?.split(' ')[1];
        const userId = ctx.from?.id;
        if (!userId) return;

        const mid = maxId(userId);

        // 1. Is this a psychologist?
        const psy = await db.user.findUnique({ where: { maxChatId: mid } });
        if (psy) {
            return showPsyMenu(ctx, psy);
        }

        // 2. Is client arriving via booking link?
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
                    create: {
                        telegramUserId: mid,
                        psychologistId,
                        telegramUsername: ctx.from?.username,
                        diaryClientId: linkClientId || null,
                    }
                });

                const psyName = targetPsy.psychologistSettings?.fullName || targetPsy.name || 'Специалист';
                return showClientMenu(ctx, psychologistId, psyName, linkClientId);
            }
        }

        // 3. Known client?
        const client = await db.diaryClient.findFirst({
            where: { telegramChatId: mid },
            include: { psychologist: true }
        });
        if (client) {
            return showClientMenu(ctx, client.psychologistId, client.name, client.id);
        }

        const tgClient = await db.telegramClient.findUnique({ where: { telegramUserId: mid } });
        if (tgClient?.psychologistId) {
            return showClientMenu(ctx, tgClient.psychologistId, tgClient.fullName || 'Клиент', tgClient.diaryClientId || undefined);
        }

        // 4. Unregistered
        await ctx.reply(
            'Добро пожаловать в КОМПАС!\n\nЕсли вы психолог — войдите в кабинет, чтобы привязать аккаунт и получать уведомления.',
            Markup.inlineKeyboard([
                [Markup.button.url('💼 Войти в кабинет', `${APP_URL}/diary/bot`)],
            ])
        );
    });

    // /sessions — upcoming sessions
    maxBot.command('sessions', async (ctx) => {
        const userId = ctx.from?.id;
        if (!userId) return;
        const mid = maxId(userId);

        const psy = await db.user.findUnique({ where: { maxChatId: mid } });
        if (psy) {
            const sessions = await db.diarySession.findMany({
                where: { psychologistId: psy.id, status: 'confirmed', date: { gte: new Date() } },
                orderBy: [{ date: 'asc' }, { time: 'asc' }],
                take: 5,
                include: { client: true }
            });

            if (!sessions.length) {
                return ctx.reply('У вас нет предстоящих подтвержденных сессий.');
            }

            let msg = '📅 Ваши ближайшие сессии:\n\n';
            sessions.forEach(s => {
                msg += `👤 ${s.client.name}\n⏰ ${format(s.date, 'dd.MM.yyyy')} в ${s.time}\n📍 ${s.format === 'offline' ? 'Очно' : 'Онлайн'}\n\n`;
            });
            return ctx.reply(msg);
        }

        const client = await db.diaryClient.findFirst({ where: { telegramChatId: mid } });
        if (client) {
            const sessions = await db.diarySession.findMany({
                where: { clientId: client.id, status: 'confirmed', date: { gte: new Date() } },
                orderBy: [{ date: 'asc' }, { time: 'asc' }],
                include: { psychologist: true }
            });

            if (!sessions.length) {
                return ctx.reply('У вас нет предстоящих записей.');
            }

            let msg = '📅 Ваши записи:\n\n';
            sessions.forEach(s => {
                msg += `⏰ ${format(s.date, 'dd.MM.yyyy')} в ${s.time}\n📍 ${s.format === 'offline' ? 'Очно' : 'Онлайн'}\n\n`;
            });
            return ctx.reply(msg);
        }

        await ctx.reply('Аккаунт не найден. Перейдите по ссылке от вашего психолога.');
    });

    // /connect — generate a one-time link for psychologist account linking
    maxBot.command('connect', async (ctx) => {
        const userId = ctx.from?.id;
        if (!userId) return;
        const mid = maxId(userId);

        try {
            const res = await fetch(`${APP_URL}/api/max/connect`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-bot-token': MAX_BOT_TOKEN!,
                },
                body: JSON.stringify({ maxUserId: mid }),
            });
            const data = await res.json();

            if (data.url) {
                await ctx.reply(
                    'Нажмите на кнопку ниже, чтобы привязать ваш MAX аккаунт к КОМПАС.\n\n⚠️ Ссылка действует 15 минут.',
                    Markup.inlineKeyboard([[Markup.button.url('🔗 Привязать аккаунт', data.url)]])
                );
            } else {
                await ctx.reply('Не удалось создать ссылку. Попробуйте позже.');
            }
        } catch (e) {
            console.error('[MAX Bot] /connect error:', e);
            await ctx.reply('Ошибка сервера. Попробуйте позже.');
        }
    });

    // /cancel — last inline action (limited in MAX — fallback to URL)
    maxBot.action(/cancel_(.+)/, async (ctx) => {
        const sessionId = ctx.match[1];
        const userId = ctx.from?.id;
        const mid = maxId(userId!);

        const session = await db.diarySession.findUnique({
            where: { id: sessionId },
            include: { client: true }
        });

        if (!session || session.client.telegramChatId !== mid) {
            return ctx.answerCbQuery('Сессия не найдена или нет доступа.', { show_alert: true });
        }

        await db.diarySession.update({ where: { id: sessionId }, data: { status: 'cancelled' } });
        await ctx.editMessageText(`❌ Сессия отменена.\n\nДата: ${format(session.date, 'dd.MM.yyyy')} в ${session.time}`);
        await ctx.answerCbQuery();

        // Notify psychologist
        if (session.client.psychologistId) {
            const psy = await db.user.findUnique({ where: { id: session.client.psychologistId } });
            if (psy?.maxChatId) {
                await maxBot.telegram.sendMessage(
                    psy.maxChatId,
                    `❌ Клиент ${session.client.name} отменил сессию ${format(session.date, 'dd.MM.yyyy')} в ${session.time}.`
                );
            }
        }
    });

    console.log('[MAX Bot] Handlers registered.');
}

setupMaxBot();
