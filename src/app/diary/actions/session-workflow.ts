'use server';

import { db } from '@/lib/db';
import { auth } from '@/auth';
import { createSession } from './sessions';
import { sendTelegramMessage } from '@/lib/telegram';
import { sendMaxMessage } from '@/lib/max-bot';

async function getPsychologistId() {
    const session = await auth();
    if (!session?.user?.id) throw new Error('Unauthorized');
    return session.user.id;
}

function bookingLink(psychologistId: string, clientId: string) {
    const base = process.env.AUTH_URL || 'https://cmpas.ru';
    return `${base}/bot/book/${psychologistId}?c=${clientId}`;
}

function formatDate(date: Date) {
    return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
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

    const psyName = full.psychologist.psychologistSettings?.fullName || full.psychologist.name || 'специалисту';
    const link = bookingLink(psychologistId, full.clientId);
    const onlineLink = full.format === 'online' ? full.psychologist.psychologistSettings?.onlineSessionLink : null;
    const text = [
        `${full.client.name}, здравствуйте.`,
        `Подтверждаю запись на консультацию к ${psyName}: ${formatDate(full.date)} в ${full.time}.`,
        full.format === 'offline' ? 'Формат: очная встреча.' : 'Формат: онлайн-консультация.',
        onlineLink ? `Ссылка для подключения: ${onlineLink}` : '',
        `Подтвердить, перенести или отменить встречу можно здесь: ${link}`,
    ].filter(Boolean).join('\n');

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
            link,
        },
    };
}
