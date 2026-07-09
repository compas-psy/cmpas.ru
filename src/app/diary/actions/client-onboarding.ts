'use server';

import { auth } from '@/auth';
import { db } from '@/lib/db';
import { clientBookingLink, buildSessionClientMessage, getPaymentInstruction, createClientDocumentDelivery } from '@/lib/client-workflow';
import { sendTelegramMessage } from '@/lib/telegram';
import { sendMaxMessage } from '@/lib/max-bot';
import { createClientChannelInvite, getClientChannelStatus, type ClientChannel } from '@/lib/channel-binding';
import { extractFirstName } from '@/lib/person-name';

const APP_URL = process.env.AUTH_URL || 'https://cmpas.ru';
const TELEGRAM_BOT_USERNAME = process.env.TELEGRAM_BOT_USERNAME || 'CompasProBot';

async function getPsychologistId() {
    const session = await auth();
    if (!session?.user?.id) throw new Error('Unauthorized');
    return session.user.id;
}

export type OnboardingChannel = ClientChannel;

export async function getClientMessengerStatus(clientId: string) {
    const psychologistId = await getPsychologistId();
    const status = await getClientChannelStatus(psychologistId, clientId);
    return {
        clientId: status.clientId,
        clientName: status.clientName,
        phone: status.phone ?? null,
        hasTelegram: status.channels.telegram.connected,
        hasMax: status.channels.max.connected,
        recommendedChannel: status.recommendedChannel,
    };
}

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

    const channelStatus = await getClientChannelStatus(psychologistId, clientId).catch(() => null);

    return {
        clientId: client.id,
        clientName: client.name,
        phone: client.phone ?? null,
        hasTelegram: Boolean(client.telegramChatId),
        hasMax: Boolean(client.maxChatId),
        recommendedChannel: channelStatus?.recommendedChannel || (client.maxChatId ? 'max' as const : client.telegramChatId ? 'telegram' as const : 'max' as const),
        documents,
        hasSession: Boolean(session),
    };
}

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

    let htmlText: string;
    let plainText: string;
    if (session) {
        const onlineLink = session.format === 'online' ? psych?.psychologistSettings?.onlineSessionLink : null;
        const paymentText = await getPaymentInstruction(psychologistId, session.id, clientId);
        const base = {
            clientName: client.name,
            psychologistName: psyName,
            date: session.date,
            time: session.time,
            format: session.format,
            onlineLink,
            documentLinks,
            paymentText,
            bookingLink,
        };
        htmlText = buildSessionClientMessage({ ...base, mode: 'html' });
        plainText = buildSessionClientMessage({ ...base, mode: 'plain' });
    } else {
        const firstName = extractFirstName(client.name) || client.name;
        const lines = [`${firstName}, здравствуйте!`, '', `На связи специалист ${psyName}.`];
        if (documentLinks.length) {
            lines.push('', 'Записываясь на консультацию, вы соглашаетесь с условиями договора:');
            lines.push(...documentLinks.map(d => `<a href="${d.link}">${d.title}</a>`));
        }
        lines.push('', `Управлять записями можно <a href="${bookingLink}">здесь</a>.`);
        htmlText = lines.join('\n');

        const plainLines = [`${firstName}, здравствуйте!`, '', `На связи специалист ${psyName}.`];
        if (documentLinks.length) {
            plainLines.push('', 'Записываясь на консультацию, вы соглашаетесь с условиями договора:');
            plainLines.push(...documentLinks.map(d => `${d.title}: ${d.link}`));
        }
        plainLines.push('', `Управлять записями можно здесь: ${bookingLink}`);
        plainText = plainLines.join('\n');
    }

    const chatId = opts.channel === 'telegram' ? client.telegramChatId : client.maxChatId;
    if (chatId) {
        if (opts.channel === 'telegram') {
            await sendTelegramMessage(chatId, htmlText, { parse_mode: 'HTML', disable_web_page_preview: true });
        } else {
            await sendMaxMessage(chatId, plainText);
        }
        return { status: 'sent' as const, channel: opts.channel };
    }

    const invite = await createClientChannelInvite({ psychologistId, clientId, channel: opts.channel });

    await db.scheduledClientMessage.create({
        data: {
            psychologistId,
            clientId,
            sessionId: session?.id ?? null,
            channel: opts.channel,
            text: htmlText,
            sendAt: invite.expiresAt,
            status: 'pending',
        },
    });

    let preparedInTelegram = false;
    if (opts.channel === 'telegram' && psych?.telegramChatId) {
        const callbackUrl = `${APP_URL}/api/channel-binding/telegram-login?token=${encodeURIComponent(invite.rawToken)}`;
        const firstName = extractFirstName(client.name) || client.name;
        await sendTelegramMessage(
            psych.telegramChatId,
            `${firstName}, подключите уведомления о записях.\n\nКОМПАС будет присылать только подтверждения, напоминания, переносы и отмены встреч.`,
            {
                parse_mode: 'HTML',
                disable_web_page_preview: true,
                reply_markup: {
                    inline_keyboard: [[{
                        text: 'Подключить уведомления',
                        login_url: {
                            url: callbackUrl,
                            forward_text: 'Подключить уведомления',
                            bot_username: TELEGRAM_BOT_USERNAME,
                            request_write_access: true,
                        },
                    }]],
                },
            },
        );
        preparedInTelegram = true;
    }

    return {
        status: 'pending' as const,
        channel: opts.channel,
        inviteLink: invite.smartLink,
        directLink: invite.directLink,
        shareText: invite.shareText,
        readyText: plainText,
        phone: client.phone ?? null,
        expiresAt: invite.expiresAt.toISOString(),
        preparedInTelegram,
    };
}

export async function generateClientInviteLink(clientId: string, channel: OnboardingChannel = 'max') {
    const psychologistId = await getPsychologistId();
    const invite = await createClientChannelInvite({ psychologistId, clientId, channel });
    return {
        inviteLink: invite.smartLink,
        directLink: invite.directLink,
        shareText: invite.shareText,
        channel,
        expiresAt: invite.expiresAt.toISOString(),
        clientName: invite.clientName,
        phone: invite.phone ?? null,
    };
}
