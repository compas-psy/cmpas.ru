'use server';

import { auth } from '@/auth';
import { db } from '@/lib/db';
import { randomBytes } from 'crypto';
import { clientBookingLink, buildSessionClientMessage, getPaymentInstruction, createClientDocumentDelivery } from '@/lib/client-workflow';
import { sendTelegramMessage } from '@/lib/telegram';
import { sendMaxMessage } from '@/lib/max-bot';

const TELEGRAM_BOT_USERNAME = process.env.TELEGRAM_BOT_USERNAME || 'CompasProBot';
const MAX_BOT_USERNAME = process.env.MAX_BOT_USERNAME || '';

async function getPsychologistId() {
    const session = await auth();
    if (!session?.user?.id) throw new Error('Unauthorized');
    return session.user.id;
}

export type OnboardingChannel = 'telegram' | 'max';

/** Messenger connection status for a client. */
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

/** Everything the onboarding modal needs: messenger status, documents, and whether a session exists. */
export async function getOnboardingOptions(clientId: string) {
    const psychologistId = await getPsychologistId();
    const client = await db.diaryClient.findFirst({
        where: { id: clientId, psychologistId },
        select: { id: true, name: true, phone: true, telegramChatId: true, maxChatId: true },
    });
    if (!client) throw new Error('Клиент не найден');

    let documents: Array<{ id: string; title: string }> = [];
    try {
        const rows = await db.$queryRaw<Array<{ id: string; title: string }>>`
            SELECT id, title FROM "PsychologistClientDocument"
            WHERE "psychologistId" = ${psychologistId} AND "isActive" = true
            ORDER BY "sortOrder" ASC, "createdAt" ASC
        `;
        documents = rows.map(r => ({ id: r.id, title: r.title }));
    } catch { /* table may not exist */ }

    const session = await db.diarySession.findFirst({
        where: { clientId, psychologistId, status: { not: 'cancelled' } },
        orderBy: { date: 'asc' },
        select: { id: true },
    });

    return {
        clientId: client.id,
        clientName: client.name,
        phone: client.phone ?? null,
        hasTelegram: !!client.telegramChatId,
        hasMax: !!(client as any).maxChatId,
        documents,
        hasSession: !!session,
    };
}

function buildInviteLink(channel: OnboardingChannel, token: string) {
    if (channel === 'telegram') return `https://t.me/${TELEGRAM_BOT_USERNAME}?start=c_${token}`;
    return MAX_BOT_USERNAME
        ? `https://max.ru/join/${MAX_BOT_USERNAME}?start=c_${token}`
        : `https://cmpas.ru/max-invite?token=${token}`;
}

/**
 * Send the onboarding message(s) to a client via the chosen priority messenger.
 *
 * - If the client is already connected to that messenger → sends immediately via bot.
 * - If not connected → cannot push (Telegram/MAX forbid first contact). We then:
 *     1. queue the message to auto-deliver the moment the client opens the bot,
 *     2. generate an invite deep-link to share,
 *     3. return ready-to-copy text for manual delivery.
 */
export async function sendClientOnboarding(
    clientId: string,
    opts: { channel: OnboardingChannel; sendNotification: boolean; documentId?: string | null },
) {
    const psychologistId = await getPsychologistId();
    const client = await db.diaryClient.findFirst({ where: { id: clientId, psychologistId } });
    if (!client) throw new Error('Клиент не найден');

    const psych = await db.user.findUnique({
        where: { id: psychologistId },
        include: { psychologistSettings: true },
    });
    const psyName = psych?.psychologistSettings?.fullName || psych?.name || 'специалист';
    const bookingLink = clientBookingLink(psychologistId, clientId);

    const session = opts.sendNotification
        ? await db.diarySession.findFirst({
            where: { clientId, psychologistId, status: { not: 'cancelled' } },
            orderBy: { date: 'asc' },
        })
        : null;

    let documentLinks: Array<{ title: string; link: string }> = [];
    if (opts.documentId) {
        const delivery = await createClientDocumentDelivery({
            psychologistId,
            clientId,
            sessionId: session?.id ?? null,
            channel: opts.channel,
            recipientContact: client.phone || client.email || null,
            documentId: opts.documentId,
        });
        documentLinks = [{ title: delivery.title, link: delivery.link }];
    }

    let text: string;
    if (session) {
        const onlineLink = session.format === 'online' ? psych?.psychologistSettings?.onlineSessionLink : null;
        const paymentText = await getPaymentInstruction(psychologistId, session.id, clientId);
        text = buildSessionClientMessage({
            clientName: client.name,
            psychologistName: psyName,
            date: session.date,
            time: session.time,
            format: session.format,
            onlineLink,
            documentLinks,
            paymentText,
            bookingLink,
        });
    } else {
        const lines = [`${client.name}, здравствуйте.`, '', `На связи ${psyName}.`];
        if (documentLinks.length) {
            lines.push('Документы для ознакомления:', ...documentLinks.map(d => `— ${d.title}: ${d.link}`));
        }
        lines.push(`Ссылка для управления записями: ${bookingLink}`);
        text = lines.filter(Boolean).join('\n');
    }

    const chatId = opts.channel === 'telegram' ? client.telegramChatId : (client as any).maxChatId as string | null;

    if (chatId) {
        if (opts.channel === 'telegram') await sendTelegramMessage(chatId, text);
        else await sendMaxMessage(chatId, text);
        return { status: 'sent' as const, channel: opts.channel };
    }

    // Not connected — queue for auto-delivery, generate invite, return ready text.
    const token = randomBytes(24).toString('base64url');
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await db.clientInviteToken.create({
        data: { psychologistId, clientId, token, channel: opts.channel, expiresAt },
    });

    // sendAt far in the future so the cron won't mark it failed before the
    // client connects; the bot connect handler delivers it instantly.
    await db.scheduledClientMessage.create({
        data: {
            psychologistId,
            clientId,
            sessionId: session?.id ?? null,
            channel: opts.channel,
            text,
            sendAt: expiresAt,
            status: 'pending',
        },
    });

    return {
        status: 'pending' as const,
        channel: opts.channel,
        inviteLink: buildInviteLink(opts.channel, token),
        readyText: text,
        phone: client.phone ?? null,
    };
}

/** Standalone invite link generator (kept for callers that only need a link). */
export async function generateClientInviteLink(clientId: string, channel: OnboardingChannel = 'telegram') {
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

    return {
        inviteLink: buildInviteLink(channel, token),
        channel,
        expiresAt: expiresAt.toISOString(),
        clientName: client.name,
        phone: client.phone ?? null,
    };
}
