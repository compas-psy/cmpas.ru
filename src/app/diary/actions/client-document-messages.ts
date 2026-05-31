'use server';

import { auth } from '@/auth';
import { db } from '@/lib/db';
import { clientBookingLink, createAutoDocumentDeliveries, getPaymentInstruction } from '@/lib/client-workflow';

async function getPsychologistId() {
    const session = await auth();
    if (!session?.user?.id) throw new Error('Unauthorized');
    return session.user.id;
}

export async function buildClientManualDocumentMessage(clientId: string) {
    const psychologistId = await getPsychologistId();
    const client = await db.diaryClient.findFirst({
        where: { id: clientId, psychologistId },
        include: { psychologist: { include: { psychologistSettings: true } } },
    });

    if (!client) return { success: false, error: 'Клиент не найден' };

    const channel = 'manual';
    const recipientContact = client.phone || client.email || null;
    const deliveries = await createAutoDocumentDeliveries({
        psychologistId,
        clientId: client.id,
        trigger: 'new_client',
        channel,
        recipientContact,
    });

    if (!deliveries.length) {
        return { success: false, error: 'Нет активных документов с автоотправкой новому клиенту. Включите это в разделе Документы.' };
    }

    const psyName = client.psychologist.psychologistSettings?.fullName || client.psychologist.name || 'специалист';
    const bookingLink = clientBookingLink(psychologistId, client.id);
    const paymentText = await getPaymentInstruction(psychologistId);

    const text = [
        `${client.name}, здравствуйте.`,
        '',
        `Направляю документы для начала работы с ${psyName}:`,
        ...deliveries.map(d => `— ${d.title}: ${d.link}`),
        '',
        'Пожалуйста, ознакомьтесь с документами до первой консультации.',
        paymentText || '',
        `Ссылка для управления записью: ${bookingLink}`,
    ].filter(Boolean).join('\n');

    return {
        success: true,
        text,
        bookingLink,
        documentLinks: deliveries.map(d => ({ title: d.title, link: d.link, deliveryId: d.deliveryId })),
    };
}
