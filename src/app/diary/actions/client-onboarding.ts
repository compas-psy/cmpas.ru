'use server';

import { auth } from '@/auth';
import { db } from '@/lib/db';
import { clientBookingLink, buildSessionClientMessage, getPaymentInstruction, createClientDocumentDelivery } from '@/lib/client-workflow';
import { buildClientOnboardingMessage } from '@/lib/practice/communications';
import { sendTelegramMessage } from '@/lib/telegram';
import { deliverMessage } from '@/lib/messaging/deliver';
import { createClientChannelInvite, getClientChannelStatus, type ClientChannel } from '@/lib/channel-binding';
import { extractFirstName } from '@/lib/person-name';
import { findUpcomingSessionForClient, hasUpcomingSessionForClient } from '@/lib/practice/upcoming-session';

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

    // Есть ли о чём напоминать. Раньше здесь бралась самая ранняя встреча за
    // всю историю — то есть у постоянного клиента переключатель «уведомление
    // о записи» предлагался всегда, даже когда впереди ничего нет.
    const hasUpcoming = await hasUpcomingSessionForClient({ psychologistId, clientId });

    const channelStatus = await getClientChannelStatus(psychologistId, clientId).catch(() => null);

    return {
        clientId: client.id,
        clientName: client.name,
        phone: client.phone ?? null,
        hasTelegram: Boolean(client.telegramChatId),
        hasMax: Boolean(client.maxChatId),
        recommendedChannel: channelStatus?.recommendedChannel || (client.maxChatId ? 'max' as const : client.telegramChatId ? 'telegram' as const : 'max' as const),
        documents,
        hasSession: hasUpcoming,
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

    // ИМЕННО ПРЕДСТОЯЩАЯ, а не первая в истории: см.
    // src/lib/practice/upcoming-session.ts. Здесь стояло orderBy date asc без
    // условия на дату, и клиенту приходило «Подтверждаю запись» на встречу
    // трёхмесячной давности.
    const session = opts.sendNotification
        ? await findUpcomingSessionForClient({ psychologistId, clientId })
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
        const base = { clientName: client.name, psychologistName: psyName, documentLinks, bookingLink };
        htmlText = buildClientOnboardingMessage({ ...base, mode: 'html' });
        plainText = buildClientOnboardingMessage({ ...base, mode: 'plain' });
    }

    const chatId = opts.channel === 'telegram' ? client.telegramChatId : client.maxChatId;
    if (chatId) {
        // В MAX уходит РАЗМЕЧЕННЫЙ текст, а не расплющенный. У MAX нет
        // разметки, но есть кнопки со ссылкой, и отправка сама прячет в них
        // адреса. Здесь ей отдавали текст, где адрес уже был развёрнут в
        // «подпись: адрес» — прятать было нечего, и учредитель видел голую
        // ссылку на полторы строки.
        //
        // Плоский текст остаётся там, где он и нужен: readyText — то, что
        // специалист копирует руками, и кнопок в буфере обмена не бывает.
        await deliverMessage(
            opts.channel === 'telegram'
                ? { telegramChatId: chatId, preferredChannel: 'telegram' }
                : { maxChatId: chatId, preferredChannel: 'max' },
            htmlText,
        );
        return { status: 'sent' as const, channel: opts.channel };
    }

    const invite = await createClientChannelInvite({ psychologistId, clientId, channel: opts.channel });

    await db.scheduledClientMessage.create({
        data: {
            psychologistId,
            clientId,
            sessionId: session?.id ?? null,
            channel: opts.channel,
            // В очереди лежит РАЗМЕЧЕННЫЙ текст: перевод для MAX делает сама
            // отправка, и она же прячет ссылки в кнопки. Плоский текст лишал
            // её этой возможности, и адрес приезжал голым.
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
            `${firstName}, подключите уведомления о записях.\n\nПРАКТИКА будет присылать только подтверждения, напоминания, переносы и отмены встреч.`,
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
