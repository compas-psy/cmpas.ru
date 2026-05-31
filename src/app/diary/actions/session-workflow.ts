'use server';

import { db } from '@/lib/db';
import { auth } from '@/auth';
import { createSession } from './sessions';
import { sendTelegramMessage } from '@/lib/telegram';
import { sendMaxMessage } from '@/lib/max-bot';
import { buildSessionClientMessage, clientBookingLink, createAutoDocumentDeliveries, getPaymentInstruction } from '@/lib/client-workflow';

async function getPsychologistId() {
    const session = await auth();
    if (!session?.user?.id) throw new Error('Unauthorized');
    return session.user.id;
}

export async function createSessionWithClientNotice(data: {
    clientId: string;
    date: string;
    time: string;
    duration?: number;
    type?: string;
    format?: string;
}) {
    const psychologistId = await getPsychologistId();
    const session = await createSession(data);

    const full = await db.diarySession.findFirst({
        where: { id: session.id, psychologistId },
        include: {
            client: true,
            psychologist: { include: { psychologistSettings: true } },
        },
    });

    if (!full) return { session, notice: { status: 'not_found' as const } };

    const psyName = full.psychologist.psychologistSettings?.fullName || full.psychologist.name || 'специалист';
    const bookingLink = clientBookingLink(psychologistId, full.clientId);
    const onlineLink = full.format === 'online' ? full.psychologist.psychologistSettings?.onlineSessionLink : null;
    const channel = full.client.telegramChatId ? 'telegram' : (full.client as any).maxChatId ? 'max' : 'manual';
    const recipientContact = full.client.telegramChatId || (full.client as any).maxChatId || full.client.phone || full.client.email || null;

    const deliveries = await createAutoDocumentDeliveries({
        psychologistId,
        clientId: full.clientId,
        sessionId: full.id,
        trigger: 'first_session',
        channel,
        recipientContact,
    });

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
    if (full.client.telegramChatId) {
        await sendTelegramMessage(full.client.telegramChatId, text, { parse_mode: 'HTML' });
        sentTo = 'telegram';
    } else if ((full.client as any).maxChatId) {
        await sendMaxMessage((full.client as any).maxChatId, text);
        sentTo = 'max';
    }

    return {
        session,
        notice: {
            status: sentTo ? 'sent' as const : 'manual' as const,
            channel: sentTo,
            text,
            bookingLink,
            documentLinks: deliveries.map(d => ({ title: d.title, link: d.link, deliveryId: d.deliveryId })),
        },
    };
}
