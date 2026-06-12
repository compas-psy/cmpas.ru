'use server';

import { auth } from '@/auth';
import { db } from '@/lib/db';
import { randomBytes } from 'crypto';
import { clientBookingLink, buildSessionClientMessage, getPaymentInstruction } from '@/lib/client-workflow';
import { sendTelegramMessage } from '@/lib/telegram';
import { sendMaxMessage } from '@/lib/max-bot';

const TELEGRAM_BOT_USERNAME = process.env.TELEGRAM_BOT_USERNAME || 'CompasProBot';
const MAX_BOT_USERNAME = process.env.MAX_BOT_USERNAME || '';

async function getPsychologistId() {
    const session = await auth();
    if (!session?.user?.id) throw new Error('Unauthorized');
    return session.user.id;
}

/** Check which messengers a client has connected. */
export async function getClientMessengerStatus(clientId: string) {
    const psychologistId = await getPsychologistId();
    const client = await db.diaryClient.findFirst({
        where: { id: clientId, psychologistId },
        select: { id: true, name: true, phone: true, telegramChatId: true, maxChatId: true },
    });
    if (!client) throw new Error('Клиент не найден');
    return {
        clientId: client.id,
        clientName: client.name,
        phone: client.phone ?? null,
        hasTelegram: !!client.telegramChatId,
        hasMax: !!(client as any).maxChatId,
    };
}

/** Generate a deep-link invite for the client to connect their Telegram or MAX bot account. */
export async function generateClientInviteLink(clientId: string, channel: 'telegram' | 'max' = 'telegram') {
    const psychologistId = await getPsychologistId();
    const client = await db.diaryClient.findFirst({
        where: { id: clientId, psychologistId },
        select: { id: true, name: true, phone: true },
    });
    if (!client) throw new Error('Клиент не найден');

    const token = randomBytes(24).toString('base64url');
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    await db.clientInviteToken.create({
        data: { psychologistId, clientId, token, channel, expiresAt },
    });

    const inviteLink = channel === 'telegram'
        ? `https://t.me/${TELEGRAM_BOT_USERNAME}?start=c_${token}`
        : MAX_BOT_USERNAME
            ? `https://max.ru/join/${MAX_BOT_USERNAME}?start=c_${token}`
            : `https://cmpas.ru/max-invite?token=${token}`;

    return {
        inviteLink,
        channel,
        expiresAt: expiresAt.toISOString(),
        clientName: client.name,
        phone: client.phone ?? null,
    };
}

/**
 * Send a session notification to a newly added client.
 * If a messenger is linked → sends directly.
 * If not linked → returns ready-to-copy text for manual delivery (WhatsApp, SMS, etc).
 */
export async function sendSessionNotificationToClient(clientId: string, sessionId: string) {
    const psychologistId = await getPsychologistId();

    const client = await db.diaryClient.findFirst({ where: { id: clientId, psychologistId } });
    if (!client) throw new Error('Клиент не найден');

    const session = await db.diarySession.findFirst({ where: { id: sessionId, psychologistId } });
    if (!session) throw new Error('Сессия не найдена');

    const psych = await db.user.findUnique({
        where: { id: psychologistId },
        include: { psychologistSettings: true },
    });
    const psyName = psych?.psychologistSettings?.fullName || psych?.name || 'специалист';
    const onlineLink = session.format === 'online' ? psych?.psychologistSettings?.onlineSessionLink : null;
    const bookingLink = clientBookingLink(psychologistId, clientId);
    const paymentText = await getPaymentInstruction(psychologistId, sessionId, clientId);

    const text = buildSessionClientMessage({
        clientName: client.name,
        psychologistName: psyName,
        date: session.date,
        time: session.time,
        format: session.format,
        onlineLink,
        documentLinks: [],
        paymentText,
        bookingLink,
    });

    const tgId = client.telegramChatId;
    const maxId = (client as any).maxChatId as string | null;

    if (tgId) {
        await sendTelegramMessage(tgId, text);
        return { status: 'telegram' as const, sentAt: new Date().toISOString() };
    }
    if (maxId) {
        await sendMaxMessage(maxId, text);
        return { status: 'max' as const, sentAt: new Date().toISOString() };
    }

    return { status: 'manual' as const, readyText: text, phone: client.phone ?? null };
}

/** Build welcome text for a brand-new client (for manual delivery via WhatsApp/SMS). */
export async function buildNewClientWelcomeText(clientId: string) {
    const psychologistId = await getPsychologistId();
    const client = await db.diaryClient.findFirst({
        where: { id: clientId, psychologistId },
        include: { psychologist: { include: { psychologistSettings: true } } },
    });
    if (!client) throw new Error('Клиент не найден');

    const psyName = client.psychologist.psychologistSettings?.fullName || client.psychologist.name || 'специалист';
    const bookingLink = clientBookingLink(psychologistId, client.id);

    const text = [
        `${client.name}, здравствуйте.`,
        '',
        `На связи ${psyName}. Я занесла вас в систему управления практикой.`,
        `По этой ссылке вы сможете посмотреть, подтвердить или перенести запись: ${bookingLink}`,
    ].join('\n');

    return { text, phone: client.phone ?? null, bookingLink };
}

/** Legacy – kept for back-compat. */
export async function getClientOnboardingMessage(clientId: string) {
    return buildNewClientWelcomeText(clientId);
}
