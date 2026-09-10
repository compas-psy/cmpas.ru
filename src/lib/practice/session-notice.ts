import { db } from '@/lib/db';
import { sendTelegramMessage } from '@/lib/telegram';
import { sendMaxMessage } from '@/lib/max-bot';
import { buildSessionClientMessage, clientBookingLink, createAutoDocumentDeliveries, getPaymentInstruction } from '@/lib/client-workflow';

/**
 * Сообщение клиенту о назначенной встрече — одно на все пути записи.
 *
 * Раньше это жило внутри веб-действия createSession, и мобильный маршрут
 * повторял тот же текст своей копией. Две копии одного письма расходятся
 * молча: правку вносят в одну, а человек получает другую. Появление третьего
 * пути («тот же час на срок») это и обнажило — поэтому текст переехал сюда,
 * а не размножился ещё раз.
 *
 * Здесь нет сессии пользователя: psychologistId передаётся снаружи, и вызвать
 * это можно и из server action, и из маршрута мобильного API.
 */
export async function notifyClientAboutSession(psychologistId: string, sessionId: string, isFirstSession: boolean) {
    const full = await db.diarySession.findFirst({
        where: { id: sessionId, psychologistId },
        include: {
            client: true,
            psychologist: { include: { psychologistSettings: true } },
        },
    });

    if (!full) return { status: 'not_found' as const };

    const channel = full.client.telegramChatId ? 'telegram' : (full.client as any).maxChatId ? 'max' : 'manual';
    const recipientContact = full.client.telegramChatId || (full.client as any).maxChatId || full.client.phone || full.client.email || null;
    const deliveries = isFirstSession ? await createAutoDocumentDeliveries({
        psychologistId,
        clientId: full.clientId,
        sessionId: full.id,
        trigger: 'first_session',
        channel,
        recipientContact,
    }) : [];

    const psyName = full.psychologist.psychologistSettings?.fullName || full.psychologist.name || 'специалист';
    const bookingLink = clientBookingLink(psychologistId, full.clientId);
    const onlineLink = full.format === 'online' ? full.psychologist.psychologistSettings?.onlineSessionLink : null;
    const paymentText = await getPaymentInstruction(psychologistId, full.id, full.clientId);
    const text = buildSessionClientMessage({
        clientName: full.client.name,
        psychologistName: psyName,
        date: full.date,
        time: full.time,
        format: full.format,
        onlineLink,
        documentLinks: deliveries.map(d => ({ title: d.title, link: d.link })),
        paymentText,
        bookingLink,
    });

    let sentTo: string | null = null;
    try {
        if (full.client.telegramChatId) {
            await sendTelegramMessage(full.client.telegramChatId, text, { parse_mode: 'HTML' });
            sentTo = 'telegram';
        } else if ((full.client as any).maxChatId) {
            await sendMaxMessage((full.client as any).maxChatId, text);
            sentTo = 'max';
        }
    } catch (error) {
        console.error('client notice send failed:', error);
    }

    return {
        status: sentTo ? 'sent' as const : 'manual' as const,
        channel: sentTo,
        text,
        bookingLink,
        documentLinks: deliveries.map(d => ({ title: d.title, link: d.link, deliveryId: d.deliveryId })),
    };
}
