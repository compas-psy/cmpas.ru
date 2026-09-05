import { db } from '@/lib/db';
import { sessionActionToken, sessionActionTokenExpiry, clientBookingLink, publicBaseUrl } from '@/lib/client-workflow';
import { sendTelegramMessage } from '../telegram';
import { sendMaxMessage as sendMaxText } from '../max';
import { sendMaxMessage as sendMaxFull } from '../max-bot';
import { build24hReminderText } from './reminder-text';

/** MAX-функции возвращают либо null (нет токена / HTTP не ok / исключение — см. maxApi в max-bot.ts),
 *  либо разобранный JSON-ответ, который может нести success:false при формально успешном HTTP-ответе. */
function maxSendOk(result: unknown): boolean {
    return result !== null && (result as { success?: boolean } | null)?.success !== false;
}

/**
 * Возвращает исход по каждому каналу: `true`/`false` — попытка была и её
 * результат, `null` — канал не был задействован (нет chat id). Нужно для
 * ReminderOutbox (O-260817-16): раньше отправка была "выстрелил и забыл", и
 * узнать, дошло ли сообщение, можно было только по консольным логам.
 */
async function sendNotification(
    tgChatId: string | null | undefined,
    maxChatId: string | null | undefined,
    text: string,
    options?: Parameters<typeof sendTelegramMessage>[2]
): Promise<{ telegram: boolean | null; max: boolean | null }> {
    let telegramOk: boolean | null = null;
    let maxOk: boolean | null = null;

    if (tgChatId) telegramOk = await sendTelegramMessage(tgChatId, text, options);
    if (maxChatId) {
        const telegramKeyboard = (options as any)?.reply_markup?.inline_keyboard;
        if (telegramKeyboard) {
            const maxButtons = telegramKeyboard.map((row: any[]) =>
                row.map((button: any) => button.url
                    ? { text: button.text, url: button.url }
                    : { text: button.text, payload: button.callback_data || button.payload || '' }
                )
            );
            maxOk = maxSendOk(await sendMaxFull(maxChatId, text.replace(/<[^>]+>/g, ''), maxButtons));
        } else {
            maxOk = maxSendOk(await sendMaxText(maxChatId, text.replace(/<[^>]+>/g, '')));
        }
    }

    return { telegram: telegramOk, max: maxOk };
}

/**
 * Журнал фактических отправок (O-260817-16, ReminderOutbox). Пишет
 * ОДНУ строку на пару (сессия, тип напоминания, канал) — повторный проход
 * cron по той же тройке обновляет её и увеличивает sendCount, а не плодит
 * дубли (см. @@unique в prisma/schema.prisma). Ошибка самой записи в
 * ReminderOutbox не должна ронять рассылку — это вторичный журнал, не
 * основной путь; поэтому обёрнута в try/catch, а не пробрасывается наружу.
 */
async function recordReminderOutbox(params: {
    type: 'session_24h_client' | 'session_24h_psychologist' | 'session_1h_client';
    channel: 'telegram' | 'max';
    recipient: string;
    sessionId: string;
    dueAt: Date;
    now: Date;
    ok: boolean;
}): Promise<void> {
    const { type, channel, recipient, sessionId, dueAt, now, ok } = params;
    try {
        await (db as any).reminderOutbox.upsert({
            where: { sessionId_type_channel: { sessionId, type, channel } },
            create: {
                type,
                channel,
                recipient,
                sessionId,
                dueAt,
                sentAt: ok ? now : null,
                status: ok ? 'sent' : 'error',
                error: ok ? null : `${channel} send failed — см. логи [Telegram]/[MAX API] около времени попытки`,
                sendCount: 1,
            },
            update: {
                sentAt: ok ? now : undefined,
                status: ok ? 'sent' : 'error',
                error: ok ? null : `${channel} send failed — см. логи [Telegram]/[MAX API] около времени попытки`,
                sendCount: { increment: 1 },
            },
        });
    } catch (error) {
        console.error('[processReminders] Не удалось записать ReminderOutbox:', error);
    }
}

/** Записывает исход sendNotification для каждого фактически задействованного канала. */
async function recordOutcome(
    outcome: { telegram: boolean | null; max: boolean | null },
    type: 'session_24h_client' | 'session_24h_psychologist' | 'session_1h_client',
    recipients: { telegram: string | null | undefined; max: string | null | undefined },
    sessionId: string,
    dueAt: Date,
    now: Date,
): Promise<void> {
    if (outcome.telegram !== null && recipients.telegram) {
        await recordReminderOutbox({ type, channel: 'telegram', recipient: recipients.telegram, sessionId, dueAt, now, ok: outcome.telegram });
    }
    if (outcome.max !== null && recipients.max) {
        await recordReminderOutbox({ type, channel: 'max', recipient: recipients.max, sessionId, dueAt, now, ok: outcome.max });
    }
}

/**
 * Адресаты клиента в двух каналах. Вынесено из processReminders, потому что
 * повторная отправка (resendSessionReminder) обязана выбирать получателя ровно
 * так же: разойдись эти две выборки — повтор ушёл бы не туда, куда ушёл
 * оригинал, и ReminderOutbox писал бы про разных получателей под одним ключом.
 */
function clientTargets(client: any): { telegram: string | null; max: string | null } {
    const telegramId = client?.telegramClient?.telegramUserId || client?.telegramChatId || null;
    const maxId = client?.telegramClient?.telegramUserId?.startsWith('max_')
        ? client.telegramClient.telegramUserId
        : (client?.maxChatId || null);
    // Один и тот же id в обоих полях означает MAX-пользователя: слать ему ещё и
    // «в телеграм» по тому же id — это второе сообщение тому же человеку.
    const telegramTarget = maxId && telegramId === maxId ? null : telegramId;
    return { telegram: telegramTarget, max: maxId };
}

export type ClientReminderKind = 'session_24h_client' | 'session_1h_client';

/**
 * Текст клиентского напоминания. Один источник для рассылки по расписанию и
 * для повторной отправки из приложения — иначе специалист, нажав «отправить
 * ещё раз», отправил бы клиенту не то же самое сообщение.
 */
function buildClientReminderText(session: any, kind: ClientReminderKind): string {
    const client = session.client;
    const onlineLink = session.psychologist?.psychologistSettings?.onlineSessionLink;
    if (kind === 'session_24h_client') {
        return build24hReminderText({
            clientName: client.name,
            time: session.time,
            format: session.format,
            addressName: session.address?.name,
            onlineLink,
            confirmationRequired: session.status === 'pending',
        });
    }
    const linkText = session.format === 'online' && onlineLink ? `\n🔗 Подключение: ${onlineLink}` : '';
    const confirmationText = session.status === 'pending' ? '\nПодтвердите, пожалуйста, встречу.' : '';
    return `Сессия начнётся через 1 час, в ${session.time}.${linkText}${confirmationText}`;
}

/** Момент, к которому напоминание привязано (для ReminderOutbox.dueAt). */
function reminderDueAt(session: any, kind: ClientReminderKind): Date {
    const offsetMs = kind === 'session_24h_client' ? 24 * 60 * 60 * 1000 : 60 * 60 * 1000;
    return new Date(session.date.getTime() - offsetMs);
}

type ClientReminderToggles = {
    clientReminder25hEnabled?: boolean;
    clientReminder1hEnabled?: boolean;
};

/**
 * Настройка клиентских напоминаний у специалиста (NotificationSettings).
 *
 * Задача 20: в приложении появились два тумблера — «за 24 часа» и «за час».
 * Тумблер, который ничего не выключает, — это обман, поэтому рассылка обязана
 * их читать. Отсутствие строки NotificationSettings означает не «выключено», а
 * «специалист ничего не менял»: значения по умолчанию в схеме — true, и до
 * появления тумблеров напоминания уходили всегда. Нет строки — нет и запрета.
 */
function clientReminderEnabled(
    session: { psychologist?: { notificationSettings?: ClientReminderToggles | null } | null },
    kind: ClientReminderKind,
): boolean {
    const settings = session.psychologist?.notificationSettings;
    if (!settings) return true;
    const value = kind === 'session_24h_client'
        ? settings.clientReminder25hEnabled
        : settings.clientReminder1hEnabled;
    return value !== false;
}

function sessionActions(session: { id: string; psychologistId: string; clientId: string; date: Date }, pending: boolean) {
    // Task 3 (item D): a per-action token — the 'confirm' button's token
    // does not work as the 'cancel' button's, and neither works past this
    // session or on any other session.
    const expiresAt = sessionActionTokenExpiry(session.date);
    const actionUrl = (action: 'confirm' | 'cancel') =>
        `${publicBaseUrl()}/api/client/session-action?s=${session.id}&a=${action}&t=${sessionActionToken(session.psychologistId, session.clientId, session.id, action, expiresAt)}`;
    const rows: Array<Array<{ text: string; url: string }>> = [];
    if (pending) rows.push([{ text: '✅ Подтвердить', url: actionUrl('confirm') }]);
    rows.push([
        { text: '🔄 Перенести', url: clientBookingLink(session.psychologistId, session.clientId) },
        { text: '❌ Отменить', url: actionUrl('cancel') },
    ]);
    return { reply_markup: { inline_keyboard: rows } };
}

export async function processReminders() {
    try {
        const now = new Date();
        const in24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000);
        const in1Hour = new Date(now.getTime() + 60 * 60 * 1000);
        // O-260829 §4.4: cron живёт в том же процессе, что и веб-сервер — рестарт
        // при деплое (git push → main) внутри ±15-минутного окна раньше означал
        // "напоминание потеряно навсегда": notifiedXh так и не выставлялся, а
        // следующий проход (через 15 мин) уже не находил сессию — она выпадала
        // из нижней границы окна. Верхняя граница (не напоминать заранее, если
        // до сессии ещё больше суток) остаётся; нижняя убрана — окно теперь "уже
        // пора и ещё не отправлено", а не "ровно сейчас".
        const max24 = new Date(in24Hours.getTime() + 15 * 60 * 1000);

        const sessions24 = await db.diarySession.findMany({
            where: {
                status: { in: ['pending', 'confirmed'] },
                notified24h: false,
                date: { lte: max24 },
            } as any,
            include: {
                client: { include: { telegramClient: true } },
                psychologist: { include: { psychologistSettings: true, notificationSettings: true } },
                address: true,
            },
        });

        for (const rawSession of sessions24) {
            const session = rawSession as any;
            const client = session.client;
            if (!client) continue;

            const { telegram: telegramTarget, max: maxId } = clientTargets(client);
            // O-260829 §4.4: раньше notified24h выставлялся в true безусловно
            // после цикла — сессия, у которой отправка провалилась на всех
            // задействованных каналах, помечалась "уведомлена" точно так же,
            // как и успешно отправленная, и следующий проход cron (через 15
            // мин) её уже не трогал: провал был неотличим от успеха и не
            // повторялся. Сессия без единого задействованного канала (нет ни
            // telegram, ни max ни у клиента, ни у специалиста) по-прежнему
            // считается обработанной — повторять нечего, поведение для этого
            // случая не меняется.
            let anyAttempted = false;
            let anySucceeded = false;
            const noteOutcome = (outcome: { telegram: boolean | null; max: boolean | null }) => {
                if (outcome.telegram !== null) { anyAttempted = true; if (outcome.telegram) anySucceeded = true; }
                if (outcome.max !== null) { anyAttempted = true; if (outcome.max) anySucceeded = true; }
            };

            // Task 9 (founder review): clientNotificationsEnabled is the
            // communication-policy field — never gate on origin directly.
            // This 24h round is shared with the psychologist-facing block
            // right below (same query, same notified24h flag), so it's
            // gated here in-loop rather than in the query's WHERE — a
            // query-level filter would incorrectly hide the session from
            // the psychologist-facing reminder too, which must stay
            // unaffected by this flag.
            // Задача 20 (P0): тумблер «за 24 часа» из приложения. Гейт стоит
            // здесь же, в цикле, и ровно по той же причине, что и
            // clientNotificationsEnabled выше: 24-часовой проход общий с
            // блоком для специалиста — та же выборка и тот же флаг
            // notified24h. Убери сессию из WHERE — и вместе с напоминанием
            // клиенту пропадёт напоминание специалисту, которое этот тумблер
            // не выключает.
            //
            // Флаг notified24h после выключенного напоминания выставляется по
            // прежнему правилу (`!anyAttempted || anySucceeded`): отправки не
            // было, значит и повторять каждые 15 минут нечего — выключенное
            // пользователем напоминание не превращается в вечную ошибку
            // доставки.
            if ((telegramTarget || maxId) && session.clientNotificationsEnabled
                && clientReminderEnabled(session, 'session_24h_client')) {
                const outcome = await sendNotification(
                    telegramTarget,
                    maxId,
                    buildClientReminderText(session, 'session_24h_client'),
                    sessionActions(session, session.status === 'pending'),
                );
                noteOutcome(outcome);
                await recordOutcome(
                    outcome,
                    'session_24h_client',
                    { telegram: telegramTarget, max: maxId },
                    session.id,
                    reminderDueAt(session, 'session_24h_client'),
                    now,
                );
            }

            const psychologistTelegramId = session.psychologist?.telegramChatId;
            const psychologistMaxId = session.psychologist?.maxChatId;
            if (psychologistTelegramId || psychologistMaxId) {
                const statusText = session.status === 'confirmed' ? 'подтверждена' : 'ожидает подтверждения';
                const message = `Завтра в ${session.time} сессия с клиентом ${client.name}. Статус: ${statusText}.`;
                const outcome = await sendNotification(psychologistTelegramId, psychologistMaxId, message, {
                    reply_markup: {
                        inline_keyboard: [[{ text: '👤 Профиль клиента', url: `https://cmpas.ru/diary/clients?clientId=${client.id}` }]],
                    },
                });
                noteOutcome(outcome);
                await recordOutcome(
                    outcome,
                    'session_24h_psychologist',
                    { telegram: psychologistTelegramId, max: psychologistMaxId },
                    session.id,
                    new Date(session.date.getTime() - 24 * 60 * 60 * 1000),
                    now,
                );
            }

            await db.diarySession.update({
                where: { id: session.id },
                data: { notified24h: !anyAttempted || anySucceeded } as any,
            });
        }

        const max1 = new Date(in1Hour.getTime() + 15 * 60 * 1000);
        // Task 9 (founder review): the 1h reminder has no psychologist-
        // facing counterpart sharing this query, so clientNotificationsEnabled
        // is filtered right in the WHERE clause — a session with it false
        // never enters this job at all, and never gets notified1h set, so
        // re-enabling the flag later picks it straight back up.
        //
        // Задача 20 (P0): тумблер «за час» отсекается там же и по той же
        // логике. Ветки для специалиста в этом проходе нет, значит убрать
        // сессию из выборки безопасно — и это лучше гейта в цикле: notified1h
        // остаётся false, поэтому включить напоминание обратно можно до самого
        // момента отправки, и следующий проход его подхватит.
        //
        // Отсутствие строки NotificationSettings — это «по умолчанию
        // включено», отсюда OR: нет настроек ИЛИ настройки разрешают.
        const sessions1 = await db.diarySession.findMany({
            where: {
                status: { in: ['pending', 'confirmed'] },
                notified1h: false,
                clientNotificationsEnabled: true,
                date: { lte: max1 },
                OR: [
                    { psychologist: { notificationSettings: { is: null } } },
                    { psychologist: { notificationSettings: { is: { clientReminder1hEnabled: true } } } },
                ],
            } as any,
            include: {
                client: { include: { telegramClient: true } },
                psychologist: { include: { psychologistSettings: true } },
                address: true,
            },
        });

        for (const rawSession of sessions1) {
            const session = rawSession as any;
            const client = session.client;
            if (!client) continue;

            const { telegram: telegramTarget, max: maxId } = clientTargets(client);

            let anyAttempted = false;
            let anySucceeded = false;

            if (telegramTarget || maxId) {
                const outcome = await sendNotification(
                    telegramTarget,
                    maxId,
                    buildClientReminderText(session, 'session_1h_client'),
                    sessionActions(session, session.status === 'pending'),
                );
                if (outcome.telegram !== null) { anyAttempted = true; if (outcome.telegram) anySucceeded = true; }
                if (outcome.max !== null) { anyAttempted = true; if (outcome.max) anySucceeded = true; }
                await recordOutcome(
                    outcome,
                    'session_1h_client',
                    { telegram: telegramTarget, max: maxId },
                    session.id,
                    reminderDueAt(session, 'session_1h_client'),
                    now,
                );
            }

            await db.diarySession.update({
                where: { id: session.id },
                data: { notified1h: !anyAttempted || anySucceeded } as any,
            });
        }
    } catch (error) {
        console.error('[processReminders] Ошибка вызова CRON:', error);
    }
}

/**
 * Повторная отправка клиентского напоминания по требованию специалиста.
 *
 * Зачем существует. В приложении кнопка «Отправить ещё раз» открывала окно
 * ручного сообщения, а статус напоминания («Отправлено») экран вычислял из
 * часов — если момент прошёл, значит отправлено. Сервер при этом знает
 * фактический исход: он лежит в ReminderOutbox. Эта функция даёт приложению
 * настоящую отправку тем же путём, каким шлёт рассылка по расписанию, и тот
 * же журнал — вместо догадки по часам.
 *
 * Ключ ReminderOutbox — (sessionId, type, channel), поэтому повтор обновляет
 * существующую строку и увеличивает sendCount, а не плодит дубли.
 */
export async function resendSessionReminder(params: {
    sessionId: string;
    psychologistId: string;
    kind: ClientReminderKind;
}): Promise<
    | { ok: true; channels: { telegram: boolean | null; max: boolean | null } }
    | { ok: false; reason: 'not_found' | 'no_channel' | 'send_failed' }
> {
    const { sessionId, psychologistId, kind } = params;

    // Привязка к специалисту — часть выборки, а не проверка после неё:
    // чужую сессию нельзя ни прочитать, ни разбудить.
    const rawSession = await db.diarySession.findFirst({
        where: { id: sessionId, psychologistId } as any,
        include: {
            client: { include: { telegramClient: true } },
            psychologist: { include: { psychologistSettings: true } },
            address: true,
        },
    });
    if (!rawSession) return { ok: false, reason: 'not_found' };

    const session = rawSession as any;
    if (!session.client) return { ok: false, reason: 'not_found' };

    const { telegram, max } = clientTargets(session.client);
    if (!telegram && !max) return { ok: false, reason: 'no_channel' };

    const outcome = await sendNotification(
        telegram,
        max,
        buildClientReminderText(session, kind),
        sessionActions(session, session.status === 'pending'),
    );
    await recordOutcome(
        outcome,
        kind,
        { telegram, max },
        session.id,
        reminderDueAt(session, kind),
        new Date(),
    );

    // Успех — если хотя бы один задействованный канал принял сообщение.
    // Канал, который не был задействован (null), не считается отказом.
    const attempted = [outcome.telegram, outcome.max].filter((v) => v !== null) as boolean[];
    if (attempted.length === 0 || attempted.every((v) => !v)) {
        return { ok: false, reason: 'send_failed' };
    }
    return { ok: true, channels: outcome };
}

/**
 * Фактический исход напоминаний по сессии — из ReminderOutbox, а не из часов.
 * Приложение показывало «Отправлено», как только момент напоминания проходил,
 * даже если отправка провалилась; сервер знает правду и теперь ею делится.
 */
export async function readSessionReminderStatus(params: {
    sessionId: string;
    psychologistId: string;
}): Promise<Array<{ kind: string; channel: string; status: string; sentAt: string | null; sendCount: number }>> {
    const { sessionId, psychologistId } = params;
    const session = await db.diarySession.findFirst({
        where: { id: sessionId, psychologistId } as any,
        select: { id: true },
    });
    if (!session) return [];

    const rows = await (db as any).reminderOutbox.findMany({
        where: { sessionId },
        select: { type: true, channel: true, status: true, sentAt: true, sendCount: true },
        orderBy: { dueAt: 'asc' },
    }).catch(() => []);

    return rows.map((r: any) => ({
        kind: r.type,
        channel: r.channel,
        status: r.status,
        sentAt: r.sentAt ? new Date(r.sentAt).toISOString() : null,
        sendCount: r.sendCount,
    }));
}
