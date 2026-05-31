import { createHash } from 'crypto';
import { db } from '@/lib/db';

const DEFAULT_CONSENT_TEXT = `Согласие на обработку персональных данных

Настоящим клиент подтверждает согласие на обработку персональных данных, необходимых для организации консультаций, ведения записи, коммуникации со специалистом и исполнения договорённостей о встречах.

Согласие включает обработку контактных данных, сведений о записи на консультации и иной информации, которую клиент добровольно сообщает специалисту в рамках подготовки и проведения консультаций.

Клиент подтверждает, что согласие дано добровольно и может быть отозвано в порядке, предусмотренном законодательством.`;

function appSecret() {
    return process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || 'cmpas-local-secret';
}

export function clientActionToken(psychologistId: string, clientId: string) {
    return createHash('sha256')
        .update(`${psychologistId}:${clientId}:${appSecret()}`)
        .digest('hex');
}

export function verifyClientActionToken(psychologistId: string, clientId: string, token?: string | null) {
    if (!token) return false;
    return token === clientActionToken(psychologistId, clientId);
}

export function publicBaseUrl() {
    return process.env.AUTH_URL || process.env.NEXTAUTH_URL || 'https://cmpas.ru';
}

export function clientConsentLink(psychologistId: string, clientId: string) {
    const token = clientActionToken(psychologistId, clientId);
    return `${publicBaseUrl()}/client/consent/${clientId}?psy=${psychologistId}&t=${token}`;
}

export function clientBookingLink(psychologistId: string, clientId: string) {
    return `${publicBaseUrl()}/bot/book/${psychologistId}?c=${clientId}`;
}

export async function getActiveConsentVersion() {
    let consent = await db.consentVersion.findFirst({
        where: { isActive: true },
        orderBy: { createdAt: 'desc' },
    });

    if (!consent) {
        consent = await db.consentVersion.create({
            data: {
                version: `default-${new Date().toISOString().slice(0, 10)}`,
                text: DEFAULT_CONSENT_TEXT,
                isActive: true,
            },
        });
    }

    return consent;
}

export async function recordClientConsent(params: {
    psychologistId: string;
    clientId: string;
    token?: string | null;
    ipAddress?: string | null;
}) {
    const { psychologistId, clientId, token, ipAddress } = params;
    if (!verifyClientActionToken(psychologistId, clientId, token)) {
        throw new Error('Некорректная ссылка согласия');
    }

    const client = await db.diaryClient.findFirst({
        where: { id: clientId, psychologistId },
        select: { id: true, name: true },
    });
    if (!client) throw new Error('Клиент не найден');

    const consent = await getActiveConsentVersion();
    const acceptedAt = new Date();
    const consentHash = createHash('sha256')
        .update(`${clientId}:${psychologistId}:${consent.version}:${acceptedAt.toISOString()}:${ipAddress || ''}`)
        .digest('hex');

    await db.diaryClient.update({
        where: { id: clientId },
        data: {
            consentVersion: consent.version,
            consentHash,
            consentDate: acceptedAt,
        },
    });

    return { client, consent, consentHash, acceptedAt };
}

export function buildSessionClientMessage(params: {
    clientName: string;
    psychologistName: string;
    date: Date;
    time: string;
    format: string;
    onlineLink?: string | null;
    consentLink: string;
    bookingLink: string;
    alreadyConsented: boolean;
}) {
    const dateText = params.date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
    const lines = [
        `${params.clientName}, здравствуйте.`,
        '',
        `Подтверждаю запись на консультацию к ${params.psychologistName}: ${dateText} в ${params.time}.`,
        `Формат: ${params.format === 'offline' ? 'очная встреча' : 'онлайн-консультация'}.`,
        params.onlineLink && params.format !== 'offline' ? `Ссылка для подключения: ${params.onlineLink}` : '',
        '',
        params.alreadyConsented
            ? 'Согласие на обработку персональных данных уже зафиксировано.'
            : `Перед первой встречей, пожалуйста, подтвердите информированное согласие: ${params.consentLink}`,
        `Подтвердить, перенести или отменить встречу можно здесь: ${params.bookingLink}`,
    ];

    return lines.filter(Boolean).join('\n');
}
