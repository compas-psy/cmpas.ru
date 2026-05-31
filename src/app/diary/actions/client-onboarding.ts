'use server';

import { auth } from '@/auth';
import { db } from '@/lib/db';
import { clientBookingLink, createClientDocumentDelivery } from '@/lib/client-workflow';

async function getPsychologistId() {
    const session = await auth();
    if (!session?.user?.id) throw new Error('Unauthorized');
    return session.user.id;
}

export async function getClientOnboardingMessage(clientId: string) {
    const psychologistId = await getPsychologistId();
    const client = await db.diaryClient.findFirst({
        where: { id: clientId, psychologistId },
        include: { psychologist: { include: { psychologistSettings: true } } },
    });
    if (!client) throw new Error('Клиент не найден');

    const psyName = client.psychologist.psychologistSettings?.fullName || client.psychologist.name || 'специалист';
    const bookingLink = clientBookingLink(psychologistId, client.id);
    const delivery = await createClientDocumentDelivery({
        psychologistId,
        clientId: client.id,
        channel: 'manual',
        recipientContact: client.phone || client.email || null,
    });

    const text = [
        `${client.name}, здравствуйте.`,
        '',
        `Это рабочая ссылка для взаимодействия с ${psyName}:`,
        `• ознакомиться с условиями работы: ${delivery.link}`,
        `• посмотреть, подтвердить, перенести или отменить запись: ${bookingLink}`,
        '',
        'Оплата консультации является акцептом условий работы специалиста. Перед оплатой, пожалуйста, ознакомьтесь с документом.',
    ].join('\n');

    return {
        text,
        documentLink: delivery.link,
        documentDeliveryId: delivery.deliveryId,
        bookingLink,
        documentTitle: delivery.title,
        documentVersion: delivery.version,
    };
}
