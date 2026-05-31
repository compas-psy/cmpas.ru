import { createHash, randomUUID } from 'crypto';
import { db } from '@/lib/db';

function appSecret() {
    return process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || 'cmpas-local-secret';
}

export function publicBaseUrl() {
    return process.env.AUTH_URL || process.env.NEXTAUTH_URL || 'https://cmpas.ru';
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

export function documentDeliveryToken(deliveryId: string) {
    return createHash('sha256')
        .update(`${deliveryId}:${appSecret()}`)
        .digest('hex');
}

export function verifyDocumentDeliveryToken(deliveryId: string, token?: string | null) {
    if (!token) return false;
    return token === documentDeliveryToken(deliveryId);
}

export function clientBookingLink(psychologistId: string, clientId: string) {
    return `${publicBaseUrl()}/bot/book/${psychologistId}?c=${clientId}`;
}

export function clientDocumentLink(deliveryId: string) {
    const token = documentDeliveryToken(deliveryId);
    return `${publicBaseUrl()}/client/documents/${deliveryId}?t=${token}`;
}

export async function ensureDefaultSpecialistDocument(psychologistId: string) {
    const existing = await db.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM "PsychologistClientDocument"
        WHERE "psychologistId" = ${psychologistId}
          AND type = 'informed_consent_offer'
          AND "isActive" = true
        ORDER BY "createdAt" DESC
        LIMIT 1
    `;

    if (existing[0]?.id) return existing[0].id;

    const id = randomUUID();
    const now = new Date();
    const title = 'Информированное согласие / оферта';
    const version = '2026-04-01-v1';
    const content = `ИНФОРМИРОВАННОЕ СОГЛАСИЕ\n(порядок оказания консультативных услуг)\n\nНастоящий документ определяет правила оказания психологических консультативных услуг специалистом и порядок их оказания.\n\nОплата консультации является акцептом условий документа. Акцептом является 100% оплата услуг по QR-коду или направленной платежной ссылке в мессенджере и/или по электронной почте.\n\nКлиенту необходимо ознакомиться с условиями до оплаты и начала консультации. Документ содержит условия проведения консультации, порядок оплаты, права и обязанности сторон, правила отмены и переноса консультаций, ответственность сторон и реквизиты специалиста.`;
    const contentHash = createHash('sha256').update(content).digest('hex');

    await db.$executeRaw`
        INSERT INTO "PsychologistClientDocument"
            (id, "psychologistId", title, type, version, content, "contentHash", "isActive", "createdAt", "updatedAt")
        VALUES
            (${id}, ${psychologistId}, ${title}, 'informed_consent_offer', ${version}, ${content}, ${contentHash}, true, ${now}, ${now})
    `;

    return id;
}

export async function createClientDocumentDelivery(params: {
    psychologistId: string;
    clientId: string;
    sessionId?: string | null;
    channel?: string | null;
    recipientContact?: string | null;
    documentId?: string | null;
}) {
    const documentId = params.documentId || await ensureDefaultSpecialistDocument(params.psychologistId);
    const documentRows = await db.$queryRaw<Array<{
        id: string;
        title: string;
        version: string;
        contentHash: string;
    }>>`
        SELECT id, title, version, "contentHash" FROM "PsychologistClientDocument"
        WHERE id = ${documentId} AND "psychologistId" = ${params.psychologistId} AND "isActive" = true
        LIMIT 1
    `;

    const doc = documentRows[0];
    if (!doc) throw new Error('Документ специалиста не найден');

    const id = randomUUID();
    const now = new Date();

    await db.$executeRaw`
        INSERT INTO "ClientDocumentDelivery"
            (id, "psychologistId", "clientId", "sessionId", "documentId", status, "deliveryChannel", "recipientContact", "documentTitle", "documentVersion", "documentContentHash", "sentAt", "createdAt", "updatedAt")
        VALUES
            (${id}, ${params.psychologistId}, ${params.clientId}, ${params.sessionId || null}, ${doc.id}, 'sent', ${params.channel || 'manual'}, ${params.recipientContact || null}, ${doc.title}, ${doc.version}, ${doc.contentHash}, ${now}, ${now}, ${now})
    `;

    return { deliveryId: id, documentId: doc.id, title: doc.title, version: doc.version, link: clientDocumentLink(id) };
}

export async function getDocumentDelivery(deliveryId: string, token?: string | null) {
    if (!verifyDocumentDeliveryToken(deliveryId, token)) throw new Error('Некорректная ссылка документа');

    const rows = await db.$queryRaw<Array<{
        id: string;
        status: string;
        documentTitle: string;
        documentVersion: string;
        sentAt: Date;
        openedAt: Date | null;
        acknowledgedAt: Date | null;
        clientName: string;
        psychologistName: string | null;
        documentContent: string;
    }>>`
        SELECT d.id, d.status, d."documentTitle", d."documentVersion", d."sentAt", d."openedAt", d."acknowledgedAt",
               c.name as "clientName",
               COALESCE(ps."fullName", u.name) as "psychologistName",
               doc.content as "documentContent"
        FROM "ClientDocumentDelivery" d
        JOIN "DiaryClient" c ON c.id = d."clientId"
        JOIN "User" u ON u.id = d."psychologistId"
        LEFT JOIN "PsychologistSettings" ps ON ps."psychologistId" = u.id
        JOIN "PsychologistClientDocument" doc ON doc.id = d."documentId"
        WHERE d.id = ${deliveryId}
        LIMIT 1
    `;

    const delivery = rows[0];
    if (!delivery) throw new Error('Документ не найден');

    if (!delivery.openedAt) {
        const now = new Date();
        await db.$executeRaw`
            UPDATE "ClientDocumentDelivery"
            SET status = CASE WHEN status = 'sent' THEN 'opened' ELSE status END,
                "openedAt" = ${now},
                "updatedAt" = ${now}
            WHERE id = ${deliveryId}
        `;
        delivery.openedAt = now;
        if (delivery.status === 'sent') delivery.status = 'opened';
    }

    return delivery;
}

export async function acknowledgeDocumentDelivery(deliveryId: string, token?: string | null) {
    if (!verifyDocumentDeliveryToken(deliveryId, token)) throw new Error('Некорректная ссылка документа');
    const now = new Date();
    await db.$executeRaw`
        UPDATE "ClientDocumentDelivery"
        SET status = 'acknowledged', "acknowledgedAt" = COALESCE("acknowledgedAt", ${now}), "openedAt" = COALESCE("openedAt", ${now}), "updatedAt" = ${now}
        WHERE id = ${deliveryId}
    `;
}

export function buildSessionClientMessage(params: {
    clientName: string;
    psychologistName: string;
    date: Date;
    time: string;
    format: string;
    onlineLink?: string | null;
    documentLink?: string | null;
    bookingLink: string;
    paymentText?: string | null;
}) {
    const dateText = params.date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
    const lines = [
        `${params.clientName}, здравствуйте.`,
        '',
        `Подтверждаю запись на консультацию к ${params.psychologistName}: ${dateText} в ${params.time}.`,
        `Формат: ${params.format === 'offline' ? 'очная встреча' : 'онлайн-консультация'}.`,
        params.onlineLink && params.format !== 'offline' ? `Ссылка для подключения: ${params.onlineLink}` : '',
        '',
        params.documentLink ? `Перед оплатой и первой встречей, пожалуйста, ознакомьтесь с условиями работы: ${params.documentLink}` : '',
        params.paymentText || '',
        `Подтвердить, перенести или отменить встречу можно здесь: ${params.bookingLink}`,
    ];

    return lines.filter(Boolean).join('\n');
}
