import { db } from '@/lib/db';
import { deliverMessage } from '@/lib/messaging/deliver';
import { sessionActionButtons } from '@/lib/practice/session-action-links';
import { buildSessionClientMessage, clientBookingLink, clientSessionLink, createAutoDocumentDeliveries, getPaymentInstruction } from '@/lib/client-workflow';

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
    // Ссылка ведёт на саму встречу: страница записи не умеет ни подтвердить,
    // ни перенести, ни отменить, а строка ниже обещает именно это.
    const manageLink = clientSessionLink(psychologistId, full.clientId, full.id);
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
        manageLink,
    });

    // ТРИ КНОПКИ — РОВНО СТОЛЬКО, СКОЛЬКО ДЕЙСТВИЙ ОБЕЩАЕТ ТЕКСТ.
    //
    // Учредитель 10.09.2026: «кнопки Подтверждаю, Перенести, Отменить».
    // Раньше в сообщении не было ни одной: строка обещала три действия и
    // отправляла человека по ссылке на страницу, где не было ни одного.
    // Подтверждение жило только в кнопке напоминания — то есть до
    // напоминания клиент не мог подтвердить встречу ничем.
    //
    // «Подтверждаю» показывается, пока встреча не подтверждена: предлагать
    // подтвердить дважды — значит делать вид, что первого раза не было.
    const buttons = sessionActionButtons(
        { psychologistId, clientId: full.clientId, sessionId: full.id, date: full.date },
        { includeConfirm: full.status !== 'confirmed' },
    );

    // Одна отправка в один канал. Раньше здесь стоял else if — правильный сам
    // по себе, но два соседних пути писали в оба мессенджера сразу, и одно
    // событие приходило дважды. Теперь правило одно на весь продукт.
    const delivery = await deliverMessage(full.client as never, text, buttons);
    const sentTo = delivery.sent ? delivery.channel : null;

    return {
        status: sentTo ? 'sent' as const : 'manual' as const,
        channel: sentTo,
        text,
        bookingLink,
        documentLinks: deliveries.map(d => ({ title: d.title, link: d.link, deliveryId: d.deliveryId })),
    };
}
