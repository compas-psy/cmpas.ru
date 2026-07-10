import { createHash, randomUUID, timingSafeEqual } from 'crypto';
import { db } from '@/lib/db';
import { extractFirstName } from '@/lib/person-name';

// Ephemeral random fallback instead of a known constant: 'cmpas-local-secret'
// was public in the repo, so anyone could forge clientActionToken /
// documentDeliveryToken (cancel any session, open any client document) if
// AUTH_SECRET were ever unset. Random fallback makes forged tokens impossible
// (existing links break on restart — the safe failure mode).
let _ephemeralSecret: string | undefined;
function appSecret() {
    const s = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
    if (s) return s;
    if (!_ephemeralSecret) {
        console.error('[client-workflow] AUTH_SECRET is not set — using an ephemeral key; client action/document links will not survive restarts.');
        _ephemeralSecret = createHash('sha256').update(randomUUID() + randomUUID()).digest('hex');
    }
    return _ephemeralSecret;
}

function safeEqualHex(a: string, b: string) {
    const ba = Buffer.from(a);
    const bb = Buffer.from(b);
    return ba.length === bb.length && timingSafeEqual(ba, bb);
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
    return safeEqualHex(token, clientActionToken(psychologistId, clientId));
}

export function documentDeliveryToken(deliveryId: string) {
    return createHash('sha256')
        .update(`${deliveryId}:${appSecret()}`)
        .digest('hex');
}

export function verifyDocumentDeliveryToken(deliveryId: string, token?: string | null) {
    if (!token) return false;
    return safeEqualHex(token, documentDeliveryToken(deliveryId));
}

export function clientBookingLink(psychologistId: string, clientId: string) {
    return `${publicBaseUrl()}/bot/book/${psychologistId}?c=${clientId}`;
}

export type CancelPolicyDecision =
    | { allowed: true }
    | { allowed: false; hoursSetting: number; hoursLeft: number };

/**
 * CANCEL-1: единая точка правды для отсечки N часов — все 4 клиентских пути
 * отмены (TG-бот, MAX-бот, signed link, miniapp) обязаны звать эту функцию,
 * а не проверять статус/время инлайн. 0 часов = без ограничений.
 */
export function canClientCancel(
    session: { date: Date; time: string },
    settings?: { cancellationHours?: number | null } | null,
): CancelPolicyDecision {
    const hoursSetting = settings?.cancellationHours ?? 24;
    if (hoursSetting <= 0) return { allowed: true };

    const [h, m] = session.time.split(':').map(Number);
    const sessionStart = new Date(session.date);
    sessionStart.setHours(h || 0, m || 0, 0, 0);

    const hoursLeft = (sessionStart.getTime() - Date.now()) / 3_600_000;
    if (hoursLeft >= hoursSetting) return { allowed: true };
    return { allowed: false, hoursSetting, hoursLeft: Math.max(0, hoursLeft) };
}

export function cancelRefusalText(hoursSetting: number) {
    return `До сессии меньше ${hoursSetting} ч — отмена уже не доступна онлайн. Напишите специалисту напрямую.`;
}

// PAY-1: DiarySession.paymentStatus predates the Prisma model definition
// (added via raw migration, see deploy/schema-fixes.sql) — read/write it via
// $queryRaw/$executeRaw everywhere, shared here so mobile API and the web
// dashboard agree on the same values instead of drifting.
export type PaymentStatus = 'not_required' | 'unpaid' | 'paid';

export function toDatabasePaymentStatus(value: unknown): PaymentStatus | null {
    const raw = String(value || '').toLowerCase();
    if (raw === 'paid') return 'paid';
    if (raw === 'unpaid') return 'unpaid';
    if (raw === 'not_required') return 'not_required';
    return null;
}

export async function readSessionPaymentStatus(sessionId: string): Promise<PaymentStatus> {
    const rows = await db.$queryRaw<Array<{ paymentStatus: string }>>`
        SELECT "paymentStatus" FROM "DiarySession" WHERE id = ${sessionId} LIMIT 1
    `;
    return (rows[0]?.paymentStatus as PaymentStatus) || 'not_required';
}

export async function writeSessionPaymentStatus(sessionId: string, value: PaymentStatus) {
    await db.$executeRaw`
        UPDATE "DiarySession" SET "paymentStatus" = ${value}, "updatedAt" = NOW() WHERE id = ${sessionId}
    `;
    if (value === 'paid') {
        await db.$executeRaw`
            UPDATE "SessionPaymentRequest"
            SET status = 'paid', "markedPaidAt" = COALESCE("markedPaidAt", NOW()), "updatedAt" = NOW()
            WHERE "sessionId" = ${sessionId}
        `;
    }
}

export function clientDocumentLink(deliveryId: string) {
    const token = documentDeliveryToken(deliveryId);
    return `${publicBaseUrl()}/client/documents/${deliveryId}?t=${token}`;
}

export async function getAutoSendDocuments(psychologistId: string, trigger: 'new_client' | 'first_session' | 'session') {
    const flag = trigger === 'new_client' ? 'sendOnNewClient' : 'sendOnFirstSession';
    const rows = await db.$queryRaw<Array<{
        id: string;
        title: string;
        version: string;
        contentHash: string;
        fileUrl: string | null;
    }>>`
        SELECT id, title, version, "contentHash", "fileUrl"
        FROM "PsychologistClientDocument"
        WHERE "psychologistId" = ${psychologistId}
          AND "isActive" = true
          AND (
            (${flag} = 'sendOnNewClient' AND "sendOnNewClient" = true)
            OR (${flag} = 'sendOnFirstSession' AND "sendOnFirstSession" = true)
          )
        ORDER BY "sortOrder" ASC, "createdAt" ASC
    `;
    return rows;
}

export async function createClientDocumentDelivery(params: {
    psychologistId: string;
    clientId: string;
    sessionId?: string | null;
    channel?: string | null;
    recipientContact?: string | null;
    documentId: string;
}) {
    const documentRows = await db.$queryRaw<Array<{
        id: string;
        title: string;
        version: string;
        contentHash: string;
    }>>`
        SELECT id, title, version, "contentHash" FROM "PsychologistClientDocument"
        WHERE id = ${params.documentId} AND "psychologistId" = ${params.psychologistId} AND "isActive" = true
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

export async function createAutoDocumentDeliveries(params: {
    psychologistId: string;
    clientId: string;
    sessionId?: string | null;
    trigger: 'new_client' | 'first_session' | 'session';
    channel?: string | null;
    recipientContact?: string | null;
}) {
    const docs = await getAutoSendDocuments(params.psychologistId, params.trigger);
    const deliveries = [] as Array<{ deliveryId: string; documentId: string; title: string; version: string; link: string }>;

    for (const doc of docs) {
        deliveries.push(await createClientDocumentDelivery({
            psychologistId: params.psychologistId,
            clientId: params.clientId,
            sessionId: params.sessionId,
            channel: params.channel,
            recipientContact: params.recipientContact,
            documentId: doc.id,
        }));
    }

    return deliveries;
}

export async function getPaymentInstruction(psychologistId: string, sessionId?: string | null, clientId?: string | null) {
    const rows = await db.$queryRaw<Array<{
        isEnabled: boolean;
        paymentText: string | null;
        paymentLink: string | null;
        paymentQrUrl: string | null;
        prepaymentRequired: boolean;
        paymentDueText: string | null;
    }>>`
        SELECT "isEnabled", "paymentText", "paymentLink", "paymentQrUrl", "prepaymentRequired", "paymentDueText"
        FROM "PsychologistPaymentSettings"
        WHERE "psychologistId" = ${psychologistId}
        LIMIT 1
    `;

    const settings = rows[0];
    if (!settings?.isEnabled) return null;
    if (!settings.paymentText && !settings.paymentLink && !settings.paymentQrUrl) return null;

    if (sessionId && clientId) {
        const id = randomUUID();
        const now = new Date();
        await db.$executeRaw`
            INSERT INTO "SessionPaymentRequest"
                (id, "sessionId", "psychologistId", "clientId", status, "paymentTextSnapshot", "paymentLinkSnapshot", "paymentQrUrlSnapshot", "sentAt", "createdAt", "updatedAt")
            VALUES
                (${id}, ${sessionId}, ${psychologistId}, ${clientId}, 'sent', ${settings.paymentText}, ${settings.paymentLink}, ${settings.paymentQrUrl}, ${now}, ${now}, ${now})
        `;
    }

    const lines = [
        settings.prepaymentRequired ? 'Оплата консультации производится по инструкции специалиста.' : 'Оплата консультации: по договорённости со специалистом.',
        settings.paymentDueText ? `Срок оплаты: ${settings.paymentDueText}` : '',
        settings.paymentText || '',
        settings.paymentLink ? `Ссылка на оплату: ${settings.paymentLink}` : '',
        settings.paymentQrUrl ? `QR-код для оплаты: ${settings.paymentQrUrl}` : '',
        'КОМПАС не принимает оплату и не подтверждает её поступление. Статус оплаты ведёт специалист.',
    ];

    return lines.filter(Boolean).join('\n');
}

export async function getDocumentDelivery(deliveryId: string, token?: string | null) {
    if (!verifyDocumentDeliveryToken(deliveryId, token)) throw new Error('Некорректная ссылка документа');

    const rows = await db.$queryRaw<Array<{
        id: string;
        status: string;
        clientId: string;
        documentTitle: string;
        documentVersion: string;
        documentContentHash: string | null;
        sentAt: Date;
        openedAt: Date | null;
        acknowledgedAt: Date | null;
        clientName: string;
        psychologistName: string | null;
        documentContent: string | null;
        fileUrl: string | null;
        fileName: string | null;
    }>>`
        SELECT d.id, d.status, d."clientId", d."documentTitle", d."documentVersion", d."documentContentHash",
               d."sentAt", d."openedAt", d."acknowledgedAt",
               c.name as "clientName",
               COALESCE(ps."fullName", u.name) as "psychologistName",
               doc.content as "documentContent",
               doc."fileUrl" as "fileUrl",
               doc."fileName" as "fileName"
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

    const rows = await db.$queryRaw<Array<{
        clientId: string;
        documentVersion: string;
        documentContentHash: string | null;
        acknowledgedAt: Date | null;
    }>>`
        SELECT "clientId", "documentVersion", "documentContentHash", "acknowledgedAt"
        FROM "ClientDocumentDelivery"
        WHERE id = ${deliveryId}
        LIMIT 1
    `;
    const delivery = rows[0];
    if (!delivery) throw new Error('Документ не найден');

    const now = new Date();
    await db.$executeRaw`
        UPDATE "ClientDocumentDelivery"
        SET status = 'acknowledged', "acknowledgedAt" = COALESCE("acknowledgedAt", ${now}), "openedAt" = COALESCE("openedAt", ${now}), "updatedAt" = ${now}
        WHERE id = ${deliveryId}
    `;

    const signedAt = (delivery.acknowledgedAt || now).toISOString();
    const consentHash = createHash('sha256')
        .update(`${delivery.clientId}:${delivery.documentVersion}:${delivery.documentContentHash || ''}:${signedAt}`)
        .digest('hex');

    await db.$executeRaw`
        UPDATE "DiaryClient"
        SET "consentDate" = COALESCE("consentDate", ${delivery.acknowledgedAt || now}),
            "consentVersion" = COALESCE("consentVersion", ${delivery.documentVersion}),
            "consentHash" = COALESCE("consentHash", ${consentHash})
        WHERE id = ${delivery.clientId}
    `;
}

/** Escape user/content text for safe insertion into Telegram HTML (parse_mode=HTML). */
export function escapeHtml(value: string) {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

/** First name only, capitalized — for a warm, personal greeting. */
function firstName(fullName: string) {
    return extractFirstName(fullName) || fullName.trim();
}

/** Human label for a video-call link, so we can hide the raw URL behind text. */
function onlineLinkLabel(url: string) {
    const u = url.toLowerCase();
    if (u.includes('telemost')) return 'Яндекс Телемост';
    if (u.includes('meet.google')) return 'Google Meet';
    if (u.includes('zoom')) return 'Zoom';
    if (u.includes('teams.microsoft') || u.includes('teams.live')) return 'Microsoft Teams';
    if (u.includes('whereby')) return 'Whereby';
    if (u.includes('contour') || u.includes('ktalk') || u.includes('kontur')) return 'Контур.Толк';
    return 'Перейти к видеовстрече';
}

/**
 * Builds the session notification for the client.
 *
 * - mode 'html'  → Telegram HTML: links hidden behind readable anchor text,
 *   bold accents, no raw URLs. Used for bot delivery (parse_mode=HTML).
 * - mode 'plain' → plain text with visible URLs. Used for manual share, where
 *   the psychologist pastes the text into a chat and no HTML parsing happens.
 */
export function buildSessionClientMessage(params: {
    clientName: string;
    psychologistName: string;
    date: Date;
    time: string;
    format: string;
    onlineLink?: string | null;
    documentLinks?: Array<{ title: string; link: string }>;
    bookingLink: string;
    paymentText?: string | null;
    mode?: 'html' | 'plain';
}) {
    const html = (params.mode ?? 'html') === 'html';
    const esc = (s: string) => (html ? escapeHtml(s) : s);
    const link = (url: string, label: string) => (html ? `<a href="${escapeHtml(url)}">${esc(label)}</a>` : `${label}: ${url}`);
    const bold = (s: string) => (html ? `<b>${esc(s)}</b>` : esc(s));

    const dateText = params.date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
    const name = esc(firstName(params.clientName));
    const psyName = esc(params.psychologistName);
    const isOnline = params.format !== 'offline';
    const formatText = isOnline ? 'онлайн-консультация' : 'очная встреча';

    const lines: string[] = [
        `${name}, здравствуйте!`,
        '',
        `Подтверждаю запись на консультацию к специалисту ${psyName}.`,
        '',
        `📅 ${bold(`${dateText} в ${params.time}`)}`,
        `Формат: ${bold(formatText)}`,
    ];

    if (params.onlineLink && isOnline) {
        lines.push('', `Ссылка для подключения: ${link(params.onlineLink, onlineLinkLabel(params.onlineLink))}`);
    }

    if (params.documentLinks?.length) {
        lines.push('', 'Записываясь на консультацию, вы соглашаетесь с условиями договора:');
        for (const d of params.documentLinks) {
            lines.push(link(d.link, d.title));
        }
    }

    if (params.paymentText) {
        lines.push('', esc(params.paymentText));
    }

    lines.push('', `Подтвердить, перенести или отменить встречу можно ${html ? `<a href="${escapeHtml(params.bookingLink)}">здесь</a>` : `здесь: ${params.bookingLink}`}.`);

    return lines.join('\n');
}
