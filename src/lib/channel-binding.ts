import { createHash, randomBytes } from 'crypto';
import { db } from '@/lib/db';
import { extractFirstName } from '@/lib/person-name';

export type ClientChannel = 'telegram' | 'max';
export type ChannelInvitePreference = ClientChannel | 'auto';

const APP_URL = process.env.AUTH_URL || 'https://cmpas.ru';
const TELEGRAM_BOT_USERNAME = process.env.TELEGRAM_BOT_USERNAME || 'CompasProBot';
const MAX_BOT_USERNAME = process.env.MAX_BOT_USERNAME || '';
const DEFAULT_TTL_MS = 72 * 60 * 60 * 1000;

function tokenHash(token: string) {
    return `sha256:${createHash('sha256').update(token).digest('hex')}`;
}

function normalizeRawToken(token: string) {
    return token.startsWith('c_') ? token.slice(2) : token;
}

export function buildDirectChannelLink(channel: ClientChannel, rawToken: string): string | null {
    const payload = `c_${rawToken}`;
    if (channel === 'telegram') {
        return `https://t.me/${TELEGRAM_BOT_USERNAME}?start=${encodeURIComponent(payload)}`;
    }
    if (!MAX_BOT_USERNAME) return null;
    return `https://max.ru/${MAX_BOT_USERNAME}?start=${encodeURIComponent(payload)}`;
}

export function buildSmartChannelLink(rawToken: string) {
    return `${APP_URL}/connect/${encodeURIComponent(rawToken)}`;
}

export function buildChannelShareText(params: {
    clientName?: string | null;
    psychologistName?: string | null;
    smartLink: string;
}) {
    const firstName = extractFirstName(params.clientName);
    const greeting = firstName ? `${firstName}, здравствуйте!` : 'Здравствуйте!';
    const from = params.psychologistName
        ? `Подключите уведомления от специалиста ${params.psychologistName}.`
        : 'Подключите уведомления о записях.';
    return `${greeting}\n\n${from}\nЭто займёт несколько секунд: ${params.smartLink}`;
}

export async function createClientChannelInvite(params: {
    psychologistId: string;
    clientId: string;
    channel: ChannelInvitePreference;
    ttlMs?: number;
}) {
    const client = await db.diaryClient.findFirst({
        where: { id: params.clientId, psychologistId: params.psychologistId },
        select: { id: true, name: true, phone: true },
    });
    if (!client) throw new Error('Клиент не найден');

    const rawToken = randomBytes(24).toString('base64url');
    const expiresAt = new Date(Date.now() + (params.ttlMs ?? DEFAULT_TTL_MS));

    await db.clientInviteToken.create({
        data: {
            psychologistId: params.psychologistId,
            clientId: params.clientId,
            token: tokenHash(rawToken),
            channel: params.channel,
            expiresAt,
        },
    });

    const psychologist = await db.user.findUnique({
        where: { id: params.psychologistId },
        select: { name: true, psychologistSettings: { select: { fullName: true } } },
    });
    const psychologistName = psychologist?.psychologistSettings?.fullName || psychologist?.name || null;
    const smartLink = buildSmartChannelLink(rawToken);
    const telegramLink = buildDirectChannelLink('telegram', rawToken);
    const maxLink = buildDirectChannelLink('max', rawToken);

    await db.auditLog.create({
        data: {
            userId: params.psychologistId,
            action: 'CLIENT_CHANNEL_INVITE_CREATED',
            provider: params.channel,
            metadata: JSON.stringify({ clientId: params.clientId, expiresAt: expiresAt.toISOString() }),
        },
    }).catch(() => undefined);

    return {
        rawToken,
        channel: params.channel,
        expiresAt,
        clientName: client.name,
        phone: client.phone,
        smartLink,
        directLink: params.channel === 'auto'
            ? smartLink
            : (params.channel === 'telegram' ? telegramLink : maxLink) || smartLink,
        directLinks: { telegram: telegramLink, max: maxLink },
        shareText: buildChannelShareText({ clientName: client.name, psychologistName, smartLink }),
    };
}

async function findInvite(rawToken: string) {
    const normalized = normalizeRawToken(rawToken);
    const hashed = tokenHash(normalized);
    return (
        await db.clientInviteToken.findUnique({ where: { token: hashed } })
    ) || (
        await db.clientInviteToken.findUnique({ where: { token: normalized } })
    );
}

export async function getPublicChannelInvite(rawToken: string) {
    const invite = await findInvite(rawToken);
    if (!invite || invite.usedAt || invite.expiresAt <= new Date()) return null;

    const [client, psychologist] = await Promise.all([
        db.diaryClient.findUnique({ where: { id: invite.clientId }, select: { name: true } }),
        db.user.findUnique({
            where: { id: invite.psychologistId },
            select: { name: true, psychologistSettings: { select: { fullName: true } } },
        }),
    ]);
    if (!client) return null;

    const channel = invite.channel as ChannelInvitePreference;
    const normalized = normalizeRawToken(rawToken);
    return {
        clientName: client.name,
        psychologistName: psychologist?.psychologistSettings?.fullName || psychologist?.name || 'специалист',
        channel,
        directLinks: {
            telegram: buildDirectChannelLink('telegram', normalized),
            max: buildDirectChannelLink('max', normalized),
        },
        expiresAt: invite.expiresAt,
    };
}

export async function consumeClientChannelInvite(params: {
    token: string;
    channel: ClientChannel;
    providerUserId: string;
    providerChatId?: string | null;
    username?: string | null;
}) {
    const invite = await findInvite(params.token);
    if (!invite) throw new Error('INVITE_NOT_FOUND');
    if (invite.channel !== 'auto' && invite.channel !== params.channel) throw new Error('INVITE_CHANNEL_MISMATCH');
    if (invite.usedAt) throw new Error('INVITE_ALREADY_USED');
    if (invite.expiresAt <= new Date()) throw new Error('INVITE_EXPIRED');

    const chatId = params.providerChatId || params.providerUserId;

    const result = await db.$transaction(async tx => {
        const fresh = await tx.clientInviteToken.findUnique({ where: { id: invite.id } });
        if (!fresh || fresh.usedAt) throw new Error('INVITE_ALREADY_USED');
        if (fresh.expiresAt <= new Date()) throw new Error('INVITE_EXPIRED');
        if (fresh.channel !== 'auto' && fresh.channel !== params.channel) throw new Error('INVITE_CHANNEL_MISMATCH');

        const client = await tx.diaryClient.update({
            where: { id: fresh.clientId },
            data: params.channel === 'telegram'
                ? { telegramChatId: chatId }
                : { maxChatId: chatId },
            select: { id: true, name: true, psychologistId: true },
        });

        if (params.channel === 'telegram') {
            await tx.telegramClient.updateMany({
                where: { diaryClientId: client.id, NOT: { telegramUserId: params.providerUserId } },
                data: { diaryClientId: null },
            });
            const existing = await tx.telegramClient.findUnique({ where: { telegramUserId: params.providerUserId } });
            await tx.telegramClient.upsert({
                where: { telegramUserId: params.providerUserId },
                update: {
                    telegramUsername: params.username || existing?.telegramUsername || null,
                    diaryClientId: client.id,
                    psychologistId: client.psychologistId,
                    fullName: client.name,
                },
                create: {
                    telegramUserId: params.providerUserId,
                    telegramUsername: params.username || null,
                    diaryClientId: client.id,
                    psychologistId: client.psychologistId,
                    fullName: client.name,
                },
            });
        }

        await tx.clientInviteToken.update({ where: { id: fresh.id }, data: { usedAt: new Date() } });
        return client;
    });

    await db.auditLog.create({
        data: {
            userId: result.psychologistId,
            action: 'CLIENT_CHANNEL_LINKED',
            provider: params.channel,
            metadata: JSON.stringify({
                clientId: result.id,
                providerUserId: params.providerUserId,
                providerChatId: chatId,
            }),
        },
    }).catch(() => undefined);

    return result;
}

export async function getClientChannelStatus(psychologistId: string, clientId: string) {
    const client = await db.diaryClient.findFirst({
        where: { id: clientId, psychologistId },
        select: { id: true, name: true, phone: true, telegramChatId: true, maxChatId: true },
    });
    if (!client) throw new Error('Клиент не найден');

    return {
        clientId: client.id,
        clientName: client.name,
        phone: client.phone,
        channels: {
            telegram: { connected: Boolean(client.telegramChatId) },
            max: { connected: Boolean(client.maxChatId) },
        },
        recommendedChannel: client.telegramChatId ? 'telegram' as const : client.maxChatId ? 'max' as const : 'telegram' as const,
    };
}

export async function revokeClientChannel(params: {
    psychologistId: string;
    clientId: string;
    channel: ClientChannel;
}) {
    const client = await db.diaryClient.findFirst({
        where: { id: params.clientId, psychologistId: params.psychologistId },
        select: { id: true, telegramChatId: true },
    });
    if (!client) throw new Error('Клиент не найден');

    await db.$transaction(async tx => {
        await tx.diaryClient.update({
            where: { id: params.clientId },
            data: params.channel === 'telegram' ? { telegramChatId: null } : { maxChatId: null },
        });
        if (params.channel === 'telegram' && client.telegramChatId) {
            await tx.telegramClient.updateMany({
                where: { telegramUserId: client.telegramChatId, diaryClientId: params.clientId },
                data: { diaryClientId: null },
            });
        }
    });

    await db.auditLog.create({
        data: {
            userId: params.psychologistId,
            action: 'CLIENT_CHANNEL_REVOKED',
            provider: params.channel,
            metadata: JSON.stringify({ clientId: params.clientId }),
        },
    }).catch(() => undefined);
}
