'use server';

import { auth } from '@/auth';
import { db } from '@/lib/db';
import { clientBookingLink, clientConsentLink } from '@/lib/client-workflow';

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
    const consentLink = clientConsentLink(psychologistId, client.id);
    const bookingLink = clientBookingLink(psychologistId, client.id);

    const text = [
        `${client.name}, здравствуйте.`,
        '',
        `Это рабочая ссылка для взаимодействия с ${psyName}:`,
        `• подтвердить информированное согласие: ${consentLink}`,
        `• посмотреть, подтвердить, перенести или отменить запись: ${bookingLink}`,
        '',
        'Если уже всё подтвердили, повторно ничего делать не нужно.',
    ].join('\n');

    return {
        text,
        consentLink,
        bookingLink,
        consentAccepted: !!client.consentDate,
        consentVersion: client.consentVersion,
        consentDate: client.consentDate,
    };
}
