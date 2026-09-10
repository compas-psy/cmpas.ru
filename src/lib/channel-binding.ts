import { createHash, randomBytes } from 'crypto';
import { db } from '@/lib/db';
import { extractFirstName } from '@/lib/person-name';
import { createNotification } from '@/lib/notifications';

export type ClientChannel = 'telegram' | 'max';
export type ChannelInvitePreference = ClientChannel | 'auto';

const APP_URL = process.env.AUTH_URL || 'https://cmpas.ru';
const TELEGRAM_BOT_USERNAME = process.env.TELEGRAM_BOT_USERNAME || 'CompasProBot';
const MAX_BOT_USERNAME = process.env.MAX_BOT_USERNAME || '';
const DEFAULT_TTL_MS = 72 * 60 * 60 * 1000;
let maxUsernameWarned = false;

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
    if (!MAX_BOT_USERNAME) {
        if (!maxUsernameWarned) {
            console.warn('[channel-binding] MAX_BOT_USERNAME is not set — MAX direct invite links are disabled. Smart /connect links still work.');
            maxUsernameWarned = true;
        }
        return null;
    }
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
        directLinks: { max: maxLink, telegram: telegramLink },
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

/**
 * Почему ссылка не открылась — словом, а не пустотой.
 *
 * Раньше функция на все три случая отвечала null, а страница звала
 * notFound(). Клиент видел «Страница не найдена» — то же самое, что при
 * опечатке в адресе, хотя ссылка была настоящей и просто уже сработала.
 * Человек в этот момент не знает ни что случилось, ни что делать.
 */
export type PublicInviteProblem = 'not_found' | 'used' | 'expired';

export async function getPublicChannelInvite(rawToken: string) {
    const invite = await findInvite(rawToken);
    if (!invite) return { problem: 'not_found' as PublicInviteProblem };
    if (invite.usedAt) return { problem: 'used' as PublicInviteProblem };
    if (invite.expiresAt <= new Date()) return { problem: 'expired' as PublicInviteProblem };

    const [client, psychologist] = await Promise.all([
        db.diaryClient.findUnique({ where: { id: invite.clientId }, select: { name: true } }),
        db.user.findUnique({
            where: { id: invite.psychologistId },
            select: { name: true, psychologistSettings: { select: { fullName: true } } },
        }),
    ]);
    if (!client) return { problem: 'not_found' as PublicInviteProblem };

    const channel = invite.channel as ChannelInvitePreference;
    const normalized = normalizeRawToken(rawToken);
    return {
        problem: null,
        clientName: client.name,
        psychologistName: psychologist?.psychologistSettings?.fullName || psychologist?.name || 'специалист',
        channel,
        directLinks: {
            max: buildDirectChannelLink('max', normalized),
            telegram: buildDirectChannelLink('telegram', normalized),
        },
        expiresAt: invite.expiresAt,
    };
}

/**
 * Что сказать человеку, когда привязка не удалась.
 *
 * Слова живут ЗДЕСЬ, а не в четырёх обработчиках — их ровно столько: два
 * бота, вебхук Telegram и вход по Telegram Login. Раньше лесенка условий
 * была скопирована в каждый, и новая причина отказа неизбежно доехала бы
 * только до части из них.
 */
export function channelInviteFailureMessage(code: string): string {
    switch (code) {
        case 'INVITE_SELF_BINDING':
            // Не ошибка пользователя: специалист проверял, работает ли то,
            // что он отправил клиенту. Поэтому и тон другой, и главное
            // сказано прямо — ссылка цела.
            return 'Это ваша собственная ссылка для клиента — по ней подключается он, а не вы. Отправьте её клиенту: она осталась действующей.';
        case 'INVITE_ALREADY_USED':
            return 'Эта ссылка уже использована. Попросите специалиста отправить новую.';
        case 'INVITE_EXPIRED':
            return 'Срок действия ссылки истёк. Попросите специалиста отправить новую.';
        default:
            return 'Ссылка недействительна. Попросите специалиста отправить новую.';
    }
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

    // САМ СПЕЦИАЛИСТ ПО СВОЕЙ ЖЕ ССЫЛКЕ — НЕ КЛИЕНТ.
    //
    // 09.09.2026: учредитель открыл ссылку-приглашение, чтобы проверить, что
    // она работает. Проверки «кто открыл» не было, и произошло ровно то, что
    // и должно было: его аккаунт мессенджера записался клиенту в карточку,
    // токен погас, настоящий клиент по той же ссылке получил «страница не
    // найдена», а наутро уведомление ДЛЯ КЛИЕНТА пришло специалисту.
    //
    // Открыть свою ссылку, чтобы посмотреть, — нормальное человеческое
    // действие, а не ошибка пользователя. Значит защищать должен код.
    //
    // Токен при этом НЕ гасится: он выдан клиенту и обязан продолжать
    // работать. Гасить его здесь значило бы наказать клиента за то, что
    // специалист заглянул в собственную ссылку.
    const issuer = await db.user.findUnique({
        where: { id: invite.psychologistId },
        select: { telegramChatId: true, maxChatId: true },
    });
    const issuerId = params.channel === 'telegram' ? issuer?.telegramChatId : issuer?.maxChatId;
    if (issuerId && (issuerId === chatId || issuerId === params.providerUserId)) {
        throw new Error('INVITE_SELF_BINDING');
    }

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

    await createNotification({
        psychologistId: result.psychologistId,
        type: 'channel_linked',
        title: `${result.name} подключил(а) ${params.channel === 'max' ? 'MAX' : 'Telegram'}`,
        subtitle: 'Уведомления и напоминания теперь приходят автоматически',
        clientId: result.id,
    });

    return result;
}

export async function expireClientChannelInvites(now = new Date()) {
    const expired = await db.clientInviteToken.findMany({
        where: { usedAt: null, expiresAt: { lte: now } },
        select: { id: true, psychologistId: true, clientId: true, channel: true, expiresAt: true },
        take: 200,
    });

    for (const invite of expired) {
        await db.auditLog.create({
            data: {
                userId: invite.psychologistId,
                action: 'CLIENT_CHANNEL_INVITE_EXPIRED',
                provider: invite.channel,
                metadata: JSON.stringify({ clientId: invite.clientId, inviteId: invite.id, expiresAt: invite.expiresAt.toISOString() }),
            },
        }).catch(() => undefined);

        await createNotification({
            psychologistId: invite.psychologistId,
            type: 'invite_expired',
            title: 'Приглашение клиента истекло',
            subtitle: 'Можно отправить новую ссылку подключения',
            clientId: invite.clientId,
        });
    }

    return { expired: expired.length };
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
            max: { connected: Boolean(client.maxChatId) },
            telegram: { connected: Boolean(client.telegramChatId) },
        },
        recommendedChannel: client.maxChatId ? 'max' as const : client.telegramChatId ? 'telegram' as const : 'max' as const,
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
