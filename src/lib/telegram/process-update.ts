/**
 * Обработка одного обновления Telegram — единственное место, где она живёт.
 *
 * Раньше это лежало прямо в маршруте вебхука, и у сторожа доставки не было
 * способа позвать ту же логику иначе, как постучавшись к самому себе по
 * HTTP на 127.0.0.1:3000. Стук не проходил: standalone-сборка Next.js
 * слушает на имени из HOSTNAME, а docker кладёт туда идентификатор
 * контейнера — то есть приложение слушает на IP контейнера, но НЕ на петле.
 * Это было известно и записано (scripts/db-doctor.sh, раздел «Куда на самом
 * деле слушает приложение»), и всё равно повторилось.
 *
 * Поэтому обработка вынесена сюда: и маршрут, и сторож зовут одну и ту же
 * функцию в том же процессе. Ни второго места с логикой бота, ни сетевого
 * звена внутри собственного процесса.
 */

/**
 * Ограничение по времени на отправку. Свой таймаут у Telegraf — 500 секунд:
 * при медленном канале (российский адрес без работающего тоннеля) вебхук
 * висел бы, Telegram считал доставку неудачной и слал повтор, а повтор
 * упирался бы в «ссылка уже использована».
 */
export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms);
        promise
            .then(v => { clearTimeout(timer); resolve(v); })
            .catch(e => { clearTimeout(timer); reject(e); });
    });
}

/* eslint-disable @typescript-eslint/no-explicit-any */

async function handleClientInvite(body: any): Promise<boolean> {
    const { bot } = await import('@/lib/telegram-bot');
    const { db } = await import('@/lib/db');
    const { consumeClientChannelInvite, channelInviteFailureMessage } = await import('@/lib/channel-binding');
    const { extractFirstName } = await import('@/lib/person-name');

    const text = body.message?.text as string | undefined;
    if (!text?.startsWith('/start c_')) return false;

    const rawToken = text.split(' ')[1]?.slice(2);
    const userId = body.message?.from?.id?.toString();
    const chatId = body.message?.chat?.id?.toString();
    if (!rawToken || !userId || !chatId || !bot) return false;

    // consumeClientChannelInvite — единственный шаг, который имеет право не
    // получиться (плохой, использованный или истёкший токен). Всё, что
    // после, — доставка по возможности: отказ отправки (связь с российского
    // адреса) НЕ должен показываться клиенту как «привязка не удалась»,
    // потому что в базе она уже удалась.
    let client;
    try {
        client = await consumeClientChannelInvite({
            token: rawToken,
            channel: 'telegram',
            providerUserId: userId,
            providerChatId: chatId,
            username: body.message?.from?.username || null,
        });
    } catch (error) {
        const code = error instanceof Error ? error.message : '';
        const message = channelInviteFailureMessage(code);
        await withTimeout(bot.telegram.sendMessage(chatId, message), 6000).catch(e => console.error('[telegram-webhook] failure notice send failed:', e instanceof Error ? e.message : e));
        return true;
    }

    try {
        await withTimeout(bot.telegram.sendMessage(
            chatId,
            `Уведомления подключены, ${extractFirstName(client.name) || client.name}!\n\nЗдесь будут только подтверждения, напоминания, переносы и отмены ваших записей.`,
        ), 6000);
    } catch (error) {
        console.error('[telegram-webhook] confirmation send failed/slow (link already succeeded):', error instanceof Error ? error.message : error);
    }

    const queued = await db.scheduledClientMessage.findMany({
        where: { clientId: client.id, channel: 'telegram', status: 'pending' },
        orderBy: { createdAt: 'asc' },
    });
    for (const message of queued) {
        try {
            await withTimeout(bot.telegram.sendMessage(chatId, message.text, {
                parse_mode: 'HTML',
                link_preview_options: { is_disabled: true },
            }), 6000);
            await db.scheduledClientMessage.update({
                where: { id: message.id },
                data: { status: 'sent', sentAt: new Date() },
            });
        } catch (error) {
            await db.scheduledClientMessage.update({
                where: { id: message.id },
                data: { status: 'failed', errorMsg: error instanceof Error ? error.message : 'Telegram send failed' },
            });
        }
    }

    return true;
}

/**
 * Разобрать обновление и отдать его обработчикам бота.
 *
 * Бросает, если бот не настроен или обработка не удалась: вызывающий сам
 * решает, что с этим делать. Маршрут вебхука отвечает Telegram двухсотым
 * (иначе тот будет слать повторы вечно), сторож — НЕ подтверждает
 * обновление, чтобы оно осталось в очереди.
 *
 * Модули подгружаются внутри функции: telegram-bot тянет за собой Prisma и
 * next-auth, и статическим импортом это попало бы в граф instrumentation.ts,
 * то есть в запуск приложения ради помощника, который нужен раз в пять минут.
 */
export async function processTelegramUpdate(body: any): Promise<void> {
    const { bot } = await import('@/lib/telegram-bot');
    if (!bot) throw new Error('Telegram bot not configured');

    // Текст сообщения и callback_data НЕ пишем: это персональные данные
    // клиента (152-ФЗ).
    console.log('[TG Webhook] update', body.update_id, body.message ? 'message' : body.callback_query ? 'callback' : 'other');

    if (await handleClientInvite(body)) return;

    await withTimeout(bot.handleUpdate(body), 8000);
}
