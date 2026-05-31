'use server';

import { db } from '@/lib/db';
import { auth } from '@/auth';
import { createSession } from './sessions';
import { sendTelegramMessage } from '@/lib/telegram';
import { sendMaxMessage } from '@/lib/max-bot';
import { buildSessionClientMessage, clientBookingLink, clientConsentLink } from '@/lib/client-workflow';

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
    const consentLink = clientConsentLink(psychologistId, full.clientId);
    const onlineLink = full.format === 'online' ? full.psychologist.psychologistSettings?.onlineSessionLink : null;
    const text = buildSessionClientMessage({
        clientName: full.client.name,
        psychologistName: psyName,
        date: full.date,
        time: full.time,
        format: full.format,
        onlineLink,
        consentLink,
        bookingLink,
        alreadyConsented: !!full.client.consentDate,
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
            consentLink,
        },
    };
}
