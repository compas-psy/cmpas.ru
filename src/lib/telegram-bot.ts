import { Telegraf, Context, Markup } from 'telegraf';
import { message } from 'telegraf/filters';
import type { Agent } from 'http';
import { db } from '@/lib/db';
import { flushQueuedMessages } from '@/lib/messaging/queued-delivery';
import { format } from 'date-fns';
import { consumeClientChannelInvite, channelInviteFailureMessage } from '@/lib/channel-binding';
import { createNotification } from '@/lib/notifications';
import { telegramSendAgent } from '@/lib/telegram-proxy';
import { autoDeleteSessionFromCalendars } from '@/lib/calendar/auto-sync';
import { canClientCancel, clientCancelBlockedMessage } from '@/lib/client-cancellation';
import { sessionActionToken, sessionActionTokenExpiry, personalClientToken } from '@/lib/client-workflow';
import { sessionActionButtons } from '@/lib/practice/session-action-links';
import { escapeHtml } from '@/lib/messaging/format';
import { notifySpecialistAboutClientAction } from '@/lib/messaging/specialist-notice';
import { SESSIONS_IN_BOT, sessionsHeading } from '@/lib/messaging/bot-session-list';
import { previewContactIntake, commitContactIntake } from '@/lib/clients/contact-intake';
import { previewMessage, commitMessage } from '@/lib/clients/contact-intake-messages';

/**
 * Подтвердить нажатие кнопки. Никогда не роняет обработчик.
 *
 * У Telegram callback_query живёт недолго, и ответить на него можно
 * только внутри этого окна. С российского адреса обновления регулярно
 * лежат у Telegram в очереди по несколько минут — к моменту, когда мы
 * добираемся до кнопки, окно закрыто, и answerCbQuery отвечает
 * «400: query is too old». 07.09.2026 это выглядело так: специалист
 * нажал «Завести», карточка в базе появилась, а он не увидел НИЧЕГО —
 * ошибка прервала обработчик на строке после создания.
 *
 * Подтверждение — косметика: оно гасит кружок на кнопке. Работа, ради
 * которой кнопку нажали, от него зависеть не должна.
 */
async function ack(ctx: Context, text?: string, extra?: { show_alert?: boolean }): Promise<void> {
    try {
        await ctx.answerCbQuery(text, extra);
    } catch (e) {
        console.warn('[TG Bot] подтвердить нажатие не удалось (окно закрыто):',
            e instanceof Error ? e.message : e);
    }
}

/**
 * Заменить текст сообщения с кнопками; если не вышло — прислать новым.
 *
 * editMessageText отказывает по тем же причинам, что и подтверждение, и
 * ещё по своим («message is not modified», сообщение слишком старое). Без
 * запасного пути человек остаётся без ответа при выполненной работе —
 * худшее из состояний: непонятно, нажалось ли.
 */
async function editOrReply(ctx: Context, text: string, extra?: Parameters<Context['editMessageText']>[1]): Promise<void> {
    try {
        await ctx.editMessageText(text, extra);
        return;
    } catch (e) {
        console.warn('[TG Bot] заменить сообщение не удалось, шлём новым:',
            e instanceof Error ? e.message : e);
    }
    await ctx.reply(text, extra as Parameters<Context['reply']>[1]).catch((e) =>
        console.error('[TG Bot] и новым сообщением не вышло:', e instanceof Error ? e.message : e));
}

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
        // Надписи без эмодзи. СТАРЫЕ варианты продолжают приниматься в
        // bot.hears ниже: клавиатура живёт в клиенте Telegram, пока бот не
        // пришлёт новую, и у человека, который просто нажмёт старую кнопку,
        // бот иначе замолчал бы.
        Markup.keyboard([
            ['Мой кабинет', 'Мои сессии'],
            ['Отправить ссылку на запись']
        ]).resize()
    );
}

async function showClientMenu(ctx: Context, psychologistId: string, clientName: string = 'Клиент', clientId?: string) {
    const bookUrl = clientId
        ? `${TELEGRAM_APP_URL}/bot/book/${psychologistId}?c=${personalClientToken(clientId)}&v=${Date.now()}`
        : `${TELEGRAM_APP_URL}/bot/book/${psychologistId}?v=${Date.now()}`;

    await ctx.reply(`Добро пожаловать, ${clientName}!\nИспользуйте меню для управления записями.`,
        Markup.keyboard([
            [Markup.button.webApp('Записаться', bookUrl)],
            [Markup.button.webApp('Мои сессии', `${TELEGRAM_APP_URL}/bot/client?v=${Date.now()}`)]
        ]).resize()
    );
}

export function setupBot() {
    if (!bot) return;

    // Собственный разбор отказов. Стоит первым: без него Telegraf при
    // любом падении обработчика печатает в журнал ВЕСЬ апдейт целиком —
    // «Unhandled error while processing { ... }». 07.09.2026 это уже
    // случилось: вместе с ошибкой про устаревшее нажатие в журнал
    // приложения, а оттуда в журнал прогона диагностики, ушли имя и
    // телефон живого человека из текста сообщения.
    //
    // Остальной код бота этого не допускает намеренно (см. маршрут
    // вебхука: «Do NOT log message text / callback data»), но библиотека
    // об этом уговоре не знает. Пишем вид обновления и текст ошибки —
    // этого хватает, чтобы понять, что сломалось, и не хватает, чтобы
    // узнать, о ком речь.
    bot.catch((error, ctx) => {
        console.error(`[TG Bot] обработчик упал на обновлении вида «${ctx.updateType}»:`,
            error instanceof Error ? error.message : error);
    });

    bot.command('connect', async (ctx: Context) => {
        const tgId = ctx.from?.id.toString();
        if (!tgId) return;

        const psy = await db.user.findUnique({ where: { telegramChatId: tgId } });
        if (psy) {
            return ctx.reply(
                'Ваш Telegram уже привязан к ПРАКТИКЕ.\n\nЧтобы также подключить MAX мессенджер — откройте страницу интеграций.',
                Markup.inlineKeyboard([[Markup.button.webApp('Интеграции', `${TELEGRAM_APP_URL}/diary/integrations`)]])
            );
        }

        await ctx.reply(
            'Чтобы привязать аккаунт психолога, войдите в кабинет:',
            Markup.inlineKeyboard([[Markup.button.webApp('Войти в кабинет', `${TELEGRAM_APP_URL}/diary/bot`)]])
        );
    });

    // Специалист пересылает боту контакт клиента из телефонной книги —
    // самый короткий путь завести карточку. Разбор, сверка с базой и
    // создание живут в общем модуле: MAX делает ровно то же самое, и
    // расходиться эти два пути не должны.
    //
    // Карточка здесь НЕ создаётся: сначала показываем, что разобрали, и
    // ждём кнопки. Пересылка контакта бывает и случайной.
    bot.on(message('contact'), async (ctx) => {
        const tgId = ctx.from?.id.toString();
        if (!tgId) return;

        const preview = await previewContactIntake({
            source: 'telegram',
            senderChatId: tgId,
            contact: ctx.message.contact,
        });

        const reply = previewMessage(preview, TELEGRAM_APP_URL);
        if (!reply) return;

        await ctx.reply(reply.text, reply.buttons.length > 0
            ? Markup.inlineKeyboard(reply.buttons.map((b) => [
                b.url ? Markup.button.url(b.label, b.url) : Markup.button.callback(b.label, b.payload ?? ''),
            ]))
            : undefined);
    });

    bot.action(/intake_(ok|no|fill)_(.+)/, async (ctx) => {
        const tgId = ctx.from?.id.toString();
        if (!tgId) return;

        // Подтверждаем ПЕРЕД работой, а не после: окно ответа у Telegram
        // короткое, и обращение к базе может его исчерпать.
        await ack(ctx);

        const psy = await db.user.findUnique({ where: { telegramChatId: tgId }, select: { id: true } });
        if (!psy) return;

        const action = ctx.match[1] === 'ok' ? 'create' : ctx.match[1] === 'fill' ? 'fill' : 'cancel';
        const result = await commitContactIntake({
            draftId: ctx.match[2],
            psychologistId: psy.id,
            action,
        });

        // Кнопки убираем: черновик погашен, второй раз нажимать нечего.
        await ctx.editMessageReplyMarkup(undefined).catch(() => {});
        // Итог — отдельным сообщением, а не заменой: новое сообщение
        // уходит независимо от возраста нажатия.
        const done = commitMessage(result, TELEGRAM_APP_URL);
        await ctx.reply(done.text, done.buttons.length > 0
            ? Markup.inlineKeyboard(done.buttons.map((b) => [
                b.url ? Markup.button.url(b.label, b.url) : Markup.button.callback(b.label, b.payload ?? ''),
            ]))
            : undefined);
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

                await ctx.reply(`Здравствуйте, ${client.name}!\n\nВаш аккаунт успешно привязан к специалисту. Теперь вы будете получать уведомления о встречах здесь.`);

                // Досылается только то, что ещё правда: правило и разбор
                // живого случая — в queued-delivery.
                await flushQueuedMessages({
                    clientId: client.id,
                    channel: 'telegram',
                    send: (text) => ctx.telegram.sendMessage(tgId, text, {
                        parse_mode: 'HTML',
                        link_preview_options: { is_disabled: true },
                    }).then(() => undefined),
                    announce: (text) => ctx.telegram.sendMessage(tgId, text).then(() => undefined),
                }).catch((e) => console.error('[telegram-bot] queued delivery failed:', e));
                return;
            } catch (e) {
                const code = e instanceof Error ? e.message : '';
                await ctx.reply(channelInviteFailureMessage(code));
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

        // Имя продукта — ПРАКТИКА. «Compas.ru» пережил переименование и
        // здоровался от имени того, чего больше нет.
        //
        // И дверь здесь одна — для специалиста: бот не знает этого человека,
        // а клиент попадает в продукт только по ссылке своего психолога.
        // Поэтому кнопка названа прямо, а клиенту сказано, что делать.
        await ctx.reply(
            'Здравствуйте! Это ПРАКТИКА — рабочая среда для психологов, коучей и профориентаторов.\n\n'
            + 'Если вы специалист — нажмите кнопку ниже, чтобы привязать кабинет и получать уведомления.\n\n'
            + 'Если вы пришли к своему специалисту — откройте ссылку, которую он вам прислал: по ней и работает запись.',
            Markup.inlineKeyboard([[Markup.button.webApp('Я специалист — привязать кабинет', `${TELEGRAM_APP_URL}/diary/bot?v=${Date.now()}`)]])
        );
    });

    bot.hears(['Мой кабинет', '💼 Мой кабинет'], async (ctx) => {
        await ctx.reply('Нажмите на кнопку ниже, чтобы перейти в свой кабинет:',
            Markup.inlineKeyboard([[Markup.button.webApp('Открыть кабинет', `${TELEGRAM_APP_URL}/diary?v=${Date.now()}`)]])
        );
    });

    bot.hears(['Отправить ссылку на запись', '🔗 Отправить ссылку на запись'], async (ctx) => {
        const tgId = ctx.from?.id.toString();
        const psy = await db.user.findUnique({ where: { telegramChatId: tgId } });
        if (!psy) return;
        await ctx.reply('Перешлите это сообщение вашему клиенту:',
            Markup.inlineKeyboard([[Markup.button.url('Записаться', `${TELEGRAM_APP_URL}/bot/book/${psy.id}?v=${Date.now()}`)]])
        );
    });

    bot.hears(['Мои сессии', '🗓 Мои сессии'], async (ctx) => {
        const tgId = ctx.from?.id.toString();
        if (!tgId) return;

        const psy = await db.user.findUnique({ where: { telegramChatId: tgId } });
        if (psy) {
            // ВСЁ ПРЕДСТОЯЩЕЕ, А НЕ ТОЛЬКО ПОДТВЕРЖДЁННОЕ.
            //
            // Здесь стоял фильтр `status: 'confirmed'` — ровно тот, который у
            // КЛИЕНТА нашли и убрали в обоих ботах (ветка ниже). У специалиста
            // он тяжелее: у клиента одна встреча, у специалиста день. Клиенты
            // жмут «Подтверждаю» далеко не всегда, и человек с пятью приёмами
            // сегодня слышал от бота, что сессий у него нет.
            const sessions = await db.diarySession.findMany({
                where: {
                    psychologistId: psy.id,
                    status: { in: ['pending', 'confirmed'] },
                    date: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
                },
                orderBy: [{ date: 'asc' }, { time: 'asc' }],
                take: SESSIONS_IN_BOT,
                include: { client: true }
            });
            if (sessions.length === 0) return ctx.reply('У вас нет предстоящих встреч.');
            // Список молча обрезан пятью — об этом сказано вслух, а не
            // оставлено человеку гадать, все ли встречи он видит.
            let msg = `<b>${sessionsHeading(sessions.length)}</b>\n\n`;
            sessions.forEach(s => {
                // Состояние названо словом: «ждёт подтверждения» — это то, из-за
                // чего встреча раньше вовсе не показывалась.
                const state = s.status === 'confirmed' ? 'Подтверждена' : 'Ждёт подтверждения';
                msg += `<b>${escapeHtml(s.client.name)}</b>\n${format(s.date, 'dd.MM.yyyy')} в ${s.time}\n${s.format === 'offline' ? 'Очно' : 'Онлайн'}\n${state}\n\n`;
            });
            return ctx.reply(msg, { parse_mode: 'HTML' });
        }

        const client = await db.diaryClient.findFirst({ where: { telegramChatId: tgId } });
        if (client) {
            // ПОКАЗЫВАЕМ ВСЁ ПРЕДСТОЯЩЕЕ, А НЕ ТОЛЬКО ПОДТВЕРЖДЁННОЕ.
            //
            // Здесь стоял фильтр `status: 'confirmed'`. Человек записывался,
            // через минуту спрашивал бота «мои сессии» — и слышал «у вас нет
            // предстоящих записей», хотя сообщение об этой самой записи
            // пришло от того же бота. Только что созданная встреча ждёт
            // подтверждения и в список не попадала.
            const sessions = await db.diarySession.findMany({
                where: {
                    clientId: client.id,
                    status: { in: ['pending', 'confirmed'] },
                    date: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
                },
                orderBy: [{ date: 'asc' }, { time: 'asc' }],
                include: { psychologist: true }
            });
            if (sessions.length === 0) return ctx.reply('У вас нет предстоящих записей.');
            for (const s of sessions) {
                const state = s.status === 'confirmed' ? 'Подтверждена' : 'Ожидает подтверждения';
                const msg = `<b>Сессия с психологом ${escapeHtml(s.psychologist.name || 'Специалист')}</b>\n\nДата: ${format(s.date, 'dd.MM.yyyy')} в ${s.time}\nФормат: ${s.format === 'offline' ? 'Очно' : 'Онлайн'}\nСостояние: ${state}`;
                // ТРИ ДЕЙСТВИЯ ИЗ ОДНОГО ИСТОЧНИКА. Кнопка «Перенести» вела на
                // страницу НОВОЙ записи — подбор времени с нуля, при том что
                // собственная встреча человека оставалась на месте. Тот же
                // дефект был найден и закрыт в напоминаниях и в сообщении о
                // записи; здесь адрес собирался по месту и остался старым.
                await ctx.reply(msg, {
                    parse_mode: 'HTML',
                    reply_markup: {
                        inline_keyboard: sessionActionButtons(
                            { psychologistId: s.psychologistId, clientId: s.clientId, sessionId: s.id, date: s.date },
                            { includeConfirm: s.status !== 'confirmed' },
                        ),
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
            return ack(ctx, 'Сессия не найдена или у вас нет доступа.', { show_alert: true });
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
            await ack(ctx, 'Отмена уже недоступна', { show_alert: true });
            return ctx.reply(message);
        }

        await db.diarySession.update({ where: { id: sessionId }, data: { status: 'cancelled' } });
        autoDeleteSessionFromCalendars(session.psychologistId, session.id).catch(console.error);

        await ack(ctx, 'Вы успешно отменили запись');
        await editOrReply(ctx, `Сессия отменена.\n\nДата: ${format(session.date, 'dd.MM.yyyy')} в ${session.time}`);

        // КАНАЛ ВЫБИРАЕТ СПЕЦИАЛИСТ, А НЕ КЛИЕНТ. Здесь стояла прямая
        // отправка в Telegram — потому что клиент нажал кнопку в Telegram.
        // Специалист, у которого привязан только MAX, об отмене не узнавал.
        await notifySpecialistAboutClientAction(session.psychologistId, {
            clientName: session.client.name,
            date: session.date,
            time: session.time,
            action: 'cancelled',
        });
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
        if (!session || session.client.telegramChatId !== tgId) return ack(ctx, 'Сессия не найдена.', { show_alert: true });

        if (session.status !== 'cancelled') {
            await db.diarySession.update({ where: { id: session.id }, data: { status: 'confirmed' } });
        }
        await ack(ctx, 'Спасибо за подтверждение!');
        await editOrReply(ctx, `Отлично, ждём вас!\n\n${format(session.date, 'dd.MM.yyyy')} в ${session.time}\n${session.format === 'offline' ? 'Очно' : 'Онлайн'}`);

        await notifySpecialistAboutClientAction(session.psychologistId, {
            clientName: session.client.name,
            date: session.date,
            time: session.time,
            action: 'confirmed',
        });
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
        if (!session || session.client.telegramChatId !== tgId) return ack(ctx, 'Сессия не найдена.', { show_alert: true });
        const token = sessionActionToken(session.psychologistId, session.clientId, session.id, 'reschedule', sessionActionTokenExpiry(session.date));
        const rescheduleUrl = `${TELEGRAM_APP_URL}/client/reschedule/${session.id}?t=${token}`;
        await ack(ctx);
        await editOrReply(ctx, 'Чтобы перенести сессию, выберите новое время:', {
            reply_markup: { inline_keyboard: [[{ text: 'Выбрать новое время', web_app: { url: rescheduleUrl } }]] }
        });
    });

    bot.action(/mood_(\d+)_(.+)/, async (ctx) => {
        const rating = parseInt(ctx.match[1]);
        const sessionId = ctx.match[2];
        try {
            await db.diarySession.update({ where: { id: sessionId }, data: { clientMoodRating: rating } as any });
        } catch (e) { console.error('[mood callback]', e); }
        // Раньше в ответ прилетал тот же смайлик, что на кнопке. Теперь оценка
    // называется словом: так понятнее, что именно записано.
    const moodWords = ['', 'Отлично', 'Хорошо', 'Нормально', 'Так себе', 'Плохо'];
        await ack(ctx);
        await editOrReply(ctx, `Спасибо за обратную связь! Записано: ${moodWords[rating] || 'ваш ответ'}.`);
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
                title: matchedClient ? `Отправить ссылку клиенту: ${matchedClient.name}` : 'Отправить ссылку на запись',
                description: 'Клиент получит ссылку для самостоятельного выбора времени',
                input_message_content: {
                    message_text: `Записаться ко мне на консультацию можно по ссылке ниже:\n\n[Выбрать время и записаться](${TELEGRAM_APP_URL}/bot/book/${psy.id}${clientQueryParam})`,
                    parse_mode: 'Markdown'
                },
                reply_markup: { inline_keyboard: [[{ text: 'Записаться', url: `${TELEGRAM_APP_URL}/bot/book/${psy.id}${clientQueryParamWithV}` }]] }
            });

            results.push({
                type: 'article',
                id: 'miniapp_calendar',
                title: matchedClient ? `Выбрать время через Telegram (для ${matchedClient.name})` : 'Выбрать время через Telegram',
                description: 'Отправит карточку с кнопкой, открывающей календарь внутри Telegram',
                input_message_content: { message_text: 'Чтобы выбрать удобное время для сессии, нажми на кнопку ниже. Откроется календарь прямо здесь, в Telegram.' },
                reply_markup: { inline_keyboard: [[{ text: 'Выбрать время', url: `https://t.me/CompasProBot?start=${linkParam}` }]] }
            });

            if (slots.length > 0) {
                const nextSlot = slots[0];
                const dayLabels = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
                results.push({
                    type: 'article',
                    id: 'nearest_slot',
                    title: `Пригласить на окно: ${dayLabels[nextSlot.dayOfWeek]} в ${nextSlot.startTime}`,
                    description: `Длительность: ${nextSlot.duration} мин`,
                    input_message_content: {
                        message_text: `У меня появилось свободное окно для сессии: *${dayLabels[nextSlot.dayOfWeek]} в ${nextSlot.startTime}*.\n\nНажми на кнопку ниже, чтобы занять его!`,
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
