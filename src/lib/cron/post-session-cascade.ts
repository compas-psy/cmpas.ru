// O-260829 §5.4: пост-сессионный каскад — по формулировке самого ТЗ v2,
// "главный WOW и главный источник повторных записей". Это НЕ то же самое,
// что processPostSessionNudge (src/lib/cron/post-session.ts) — тот старый
// mood-check механизм из v1 (оценка самочувствия), выключен по умолчанию и
// остаётся так; этот файл — отдельный, новый каскад.
//
// Три момента:
// 1. Вечерняя отметка специалиста (кто был/не пришёл) — UI, не здесь.
// 2. Через 2 часа после конца сессии клиенту: "Спасибо за встречу..." —
//    если специалист НЕ отметил "не пришёл", встреча считается состоявшейся
//    (v2: "до отметки специалиста считаем, что встреча была").
// 3. Через неделю без новой записи клиенту: "ваша ссылка всегда здесь" —
//    только если после этой сессии нет более поздней confirmed/pending.
//
// Оба сообщения — одноразовые: флаг ставится после попытки отправки
// независимо от исхода (успех/провал/нет канала) — ни разу не повторяем.
// Это единственная разница с §4.4 (там наоборот: провал не считается
// "отправлено", и напоминание должно повториться) — там пропуск письма
// напрямую вредит (человек не узнает о встрече), здесь второе письмо было бы
// давлением, которое v2 явно запрещает ("нет ответа — нет второго письма").

import { db } from '@/lib/db';
import { sendTelegramMessage } from '../telegram';
import { sendMaxMessage } from '../max';
import { clientBookingLink } from '../client-workflow';
import { getPsychologistBookingUrl } from '../booking/slug';
import { getSuggestedTimes } from '@/app/bot/actions';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

/** Тот же приём, что clientTargets() в reminders.ts — вынесен сюда отдельно,
 * а не импортирован оттуда, чтобы не тянуть в этот файл всю рассылочную
 * машинерию (ReminderOutbox и т.п.), которая этому каскаду не нужна. */
function clientChannels(client: any): { telegram: string | null; max: string | null } {
    const telegramId = client?.telegramClient?.telegramUserId || client?.telegramChatId || null;
    const maxId = client?.telegramClient?.telegramUserId?.startsWith('max_')
        ? client.telegramClient.telegramUserId
        : (client?.maxChatId || null);
    const telegramTarget = maxId && telegramId === maxId ? null : telegramId;
    return { telegram: telegramTarget, max: maxId };
}

async function sendToClient(client: any, text: string): Promise<void> {
    const { telegram, max } = clientChannels(client);
    if (telegram) await sendTelegramMessage(telegram, text).catch(console.error);
    if (max) await sendMaxMessage(max, text).catch(console.error);
}

/** Тот же расчёт конца сессии, что уже используется в processPostSessionNudge
 * (src/lib/cron/post-session.ts) — не изобретаем новый способ сложить
 * DiarySession.date (календарная дата) и time/endTime (строка "18:00"). */
function sessionEndAt(session: { date: Date; time: string; endTime?: string | null }): Date {
    const [h, m] = (session.endTime || session.time).split(':').map(Number);
    const end = new Date(session.date);
    end.setHours(h, m, 0, 0);
    return end;
}

async function psychologistDisplayName(psychologistId: string): Promise<string> {
    const psy = await db.user.findUnique({
        where: { id: psychologistId },
        select: { name: true, psychologistSettings: { select: { fullName: true } } },
    });
    return psy?.psychologistSettings?.fullName || psy?.name || 'специалист';
}

/**
 * Через 2 часа после конца сессии — если специалист не отметил "не пришёл",
 * считаем встречу состоявшейся и шлём предложение ближайшего времени.
 * Точный текст — v2 §2.4.
 */
export async function processNextBookingNudge(): Promise<void> {
    try {
        const now = new Date();
        const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
        // Фактическое отсутствие нижней границы отправки не документировано в
        // ТЗ явно (речь там о ретро-совместимости catch-up при рестарте, §4.4),
        // но это НОВОЕ поле: у всех сессий, заведённых до этого релиза,
        // nextBookingNudgeSent по умолчанию false. Без нижней границы первый
        // же проход cron разослал бы "спасибо за встречу" всем клиентам за всю
        // историю продукта разом. Минимальное изменение: как и старый
        // processPostSessionNudge (src/lib/cron/post-session.ts) для своего
        // 3-часового окна, старые сессии молча помечаются отправленными без
        // фактической отправки — 48 часов с запасом покрывает любой разумный
        // простой cron (деплой, инцидент), не трогая многолетнюю историю.
        const staleCutoff = new Date(now.getTime() - 50 * 60 * 60 * 1000);

        const sessions = await db.diarySession.findMany({
            where: {
                status: { not: 'cancelled' },
                nextBookingNudgeSent: false,
                outcome: { not: 'no_show' },
                date: { lte: now },
            } as any,
            include: {
                client: { include: { telegramClient: true } },
            },
        });

        for (const rawSession of sessions as any[]) {
            const session = rawSession;
            const end = sessionEndAt(session);
            if (end > twoHoursAgo) continue; // ещё не прошло 2 часа

            if (end < staleCutoff) {
                // Слишком старая (заведена до этого релиза либо cron не
                // работал слишком долго) — не шлём задним числом, просто
                // закрываем как обработанную.
                await db.diarySession.update({
                    where: { id: session.id },
                    data: { nextBookingNudgeSent: true } as any,
                });
                continue;
            }

            const client = session.client;
            if (client) {
                const psychologistName = await psychologistDisplayName(session.psychologistId);
                const suggestions = await getSuggestedTimes(session.psychologistId, 'any', client.id).catch(() => []);
                const next = suggestions[0];
                const timeLabel = next
                    ? `: ${format(new Date(next.date + 'T00:00:00'), 'd MMMM', { locale: ru })}, ${next.time}`
                    : '';
                const bookingBase = await getPsychologistBookingUrl(session.psychologistId).catch(() => undefined);
                const link = clientBookingLink(session.psychologistId, client.id, bookingBase);
                const text = `Спасибо за встречу. Если захотите продолжить — вот ближайшее время у ${psychologistName}${timeLabel}.\n${link}`;
                await sendToClient(client, text);
            }

            // Одноразово: провал отправки или отсутствие канала — тоже финал,
            // не повторяем (v2: "нет ответа — нет второго письма").
            await db.diarySession.update({
                where: { id: session.id },
                data: { nextBookingNudgeSent: true } as any,
            });
        }
    } catch (error) {
        console.error('[processNextBookingNudge] Ошибка:', error);
    }
}

/**
 * Раз в сутки: сессия состоялась (отмечена specialist'ом), неделя прошла,
 * повторной записи нет — одно сообщение со ссылкой на запись.
 */
export async function processWeeklyFollowup(): Promise<void> {
    try {
        const now = new Date();
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

        const sessions = await db.diarySession.findMany({
            where: {
                outcome: 'completed',
                weeklyFollowupSent: false,
                date: { lte: now },
            } as any,
            include: {
                client: { include: { telegramClient: true } },
            },
        });

        for (const rawSession of sessions as any[]) {
            const session = rawSession;
            const end = sessionEndAt(session);
            if (end > sevenDaysAgo) continue; // неделя ещё не прошла

            const futureBooking = await db.diarySession.findFirst({
                where: {
                    clientId: session.clientId,
                    psychologistId: session.psychologistId,
                    status: { in: ['pending', 'confirmed'] },
                    date: { gt: session.date },
                } as any,
                select: { id: true },
            });

            if (!futureBooking) {
                const client = session.client;
                if (client) {
                    const bookingBase = await getPsychologistBookingUrl(session.psychologistId).catch(() => undefined);
                    const link = clientBookingLink(session.psychologistId, client.id, bookingBase);
                    const text = `Если решите продолжить — ваша ссылка на запись всегда здесь.\n${link}`;
                    await sendToClient(client, text);
                }
            }

            // Одноразово при любом исходе — уже записался, канала нет или
            // отправка не удалась: второй попытки не будет.
            await db.diarySession.update({
                where: { id: session.id },
                data: { weeklyFollowupSent: true } as any,
            });
        }
    } catch (error) {
        console.error('[processWeeklyFollowup] Ошибка:', error);
    }
}
