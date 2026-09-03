import { createHash, randomUUID } from 'crypto';
import { db } from '@/lib/db';
import { extractFirstName } from '@/lib/person-name';
import { appSecret, safeEqualHex } from '@/lib/app-secret';

export function publicBaseUrl() {
    return process.env.AUTH_URL || process.env.NEXTAUTH_URL || 'https://cmpas.ru';
}

export type SessionAction = 'confirm' | 'cancel' | 'reschedule';

const SESSION_ACTION_TOKEN_PREFIX = 'sat1_';

// How long a session-action link (confirm/cancel/reschedule from a reminder
// or bot message) stays usable after the session itself — not from mint
// time. A reminder sent 24h before the session should still work if the
// client taps it right up to (or shortly after) the session, not "N days
// after we happened to send it".
const SESSION_ACTION_TOKEN_POST_SESSION_GRACE_MS = 48 * 60 * 60 * 1000; // 48h

export function sessionActionTokenExpiry(sessionDate: Date): number {
    return sessionDate.getTime() + SESSION_ACTION_TOKEN_POST_SESSION_GRACE_MS;
}

/**
 * Session-scoped action token: psychologistId + clientId + sessionId +
 * action + expiresAt, all bound into the signature. Task 3 (PRAKTIKA MVP,
 * founder review of 229d99e, item D) — the previous clientActionToken(psy,
 * client) was static per client: one token, reused across every session and
 * every action (confirm/cancel/reschedule), with no expiry. A token sent for
 * session A's reminder could cancel session B, and a confirm-link could be
 * replayed as a cancel-link. This binds and verifies all five fields, so
 * none of that cross-session/cross-action/unbounded-lifetime replay works.
 *
 * Old (pre-fix) links naturally fail closed: they don't start with the
 * sat1_ prefix, so verifySessionActionToken rejects them outright — no
 * legacy-compatibility path is needed or provided.
 */
export function sessionActionToken(
    psychologistId: string,
    clientId: string,
    sessionId: string,
    action: SessionAction,
    expiresAt: number,
): string {
    const payload = `${psychologistId}|${clientId}|${sessionId}|${action}|${expiresAt}`;
    const sig = createHash('sha256').update(`${payload}:${appSecret()}`).digest('hex').slice(0, 32);
    return SESSION_ACTION_TOKEN_PREFIX + Buffer.from(`${payload}|${sig}`).toString('base64url');
}

export function verifySessionActionToken(
    psychologistId: string,
    clientId: string,
    sessionId: string,
    action: SessionAction,
    token?: string | null,
): boolean {
    if (!token || !token.startsWith(SESSION_ACTION_TOKEN_PREFIX)) return false;
    try {
        const decoded = Buffer.from(token.slice(SESSION_ACTION_TOKEN_PREFIX.length), 'base64url').toString('utf8');
        const parts = decoded.split('|');
        if (parts.length !== 6) return false;
        const [tPsy, tClient, tSession, tAction, expiresAtStr, sig] = parts;
        // Compare the claimed fields against what the caller expects BEFORE
        // trusting the signature check below — a token is only valid for the
        // exact (psychologist, client, session, action) it was issued for.
        if (tPsy !== psychologistId || tClient !== clientId || tSession !== sessionId || tAction !== action) {
            return false;
        }
        const payload = `${tPsy}|${tClient}|${tSession}|${tAction}|${expiresAtStr}`;
        const expected = createHash('sha256').update(`${payload}:${appSecret()}`).digest('hex').slice(0, 32);
        if (!safeEqualHex(sig, expected)) return false;
        if (Date.now() > Number(expiresAtStr)) return false;
        return true;
    } catch {
        return false;
    }
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

const PERSONAL_LINK_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

// Legacy unsigned `?c=<DiaryClient.id>` links (sent before this fix shipped)
// keep working until this date, then only signed tokens are accepted. Fixed
// 90-day window from rollout (2026-08-17), not from send time — there's no
// record of when each individual old link was sent.
const LEGACY_CLIENT_ID_ACCEPTED_UNTIL = new Date('2026-11-15T00:00:00Z').getTime();

// Distinct prefix so a signed token can never be mistaken for a raw
// DiaryClient cuid (and vice versa) when deciding which path to verify.
const SIGNED_LINK_PREFIX = 'st1_';

/** Personal client link token: clientId + expiry, HMAC-signed so it can't be forged or edited. */
export function personalClientToken(clientId: string, issuedAt: number = Date.now()) {
    const expiresAt = issuedAt + PERSONAL_LINK_TTL_MS;
    const payload = `${clientId}.${expiresAt}`;
    const sig = createHash('sha256').update(`${payload}:${appSecret()}`).digest('hex').slice(0, 32);
    return SIGNED_LINK_PREFIX + Buffer.from(`${payload}.${sig}`).toString('base64url');
}

/**
 * Strict resolver: verifies the signed-token format only, never falls back
 * to the legacy unsigned-raw-clientId compatibility path. Use this — never
 * resolvePersonalClientToken — at any endpoint that discloses client,
 * session, or document data. A raw DiaryClient id (guessed, leaked back by
 * another endpoint's own response, or read from localStorage) must never by
 * itself grant access to that client's data; only a signature this server
 * issued can.
 */
export function resolveSignedPersonalClientToken(token: string | null | undefined): { clientId: string } | null {
    if (!token || !token.startsWith(SIGNED_LINK_PREFIX)) return null;
    try {
        const decoded = Buffer.from(token.slice(SIGNED_LINK_PREFIX.length), 'base64url').toString('utf8');
        const [clientId, expiresAtStr, sig] = decoded.split('.');
        if (!clientId || !expiresAtStr || !sig) return null;
        const expected = createHash('sha256').update(`${clientId}.${expiresAtStr}:${appSecret()}`).digest('hex').slice(0, 32);
        if (!safeEqualHex(sig, expected)) return null;
        if (Date.now() > Number(expiresAtStr)) return null;
        return { clientId };
    } catch {
        return null;
    }
}

/**
 * Resolves a `?c=` link parameter to a DiaryClient id.
 * - Signed token (current format): verified and checked for expiry.
 * - Anything else: accepted as a legacy raw clientId only inside the 90-day
 *   grace window, and logged as deprecated so we can see when traffic drops.
 *
 * General-purpose / UX use only (e.g. "is this link worth trying at all").
 * Never use this to gate access to client/session/document data — use
 * resolveSignedPersonalClientToken for that.
 */
export function resolvePersonalClientToken(token: string | null | undefined): { clientId: string; legacy: boolean } | null {
    if (!token) return null;

    const signed = resolveSignedPersonalClientToken(token);
    if (signed) return { clientId: signed.clientId, legacy: false };
    // A signed-format token that failed verification (tampered/expired) must
    // never fall through to legacy raw-id parsing — SIGNED_LINK_PREFIX can't
    // collide with a real DiaryClient cuid, but treat it as exhausted anyway.
    if (token.startsWith(SIGNED_LINK_PREFIX)) return null;

    if (Date.now() < LEGACY_CLIENT_ID_ACCEPTED_UNTIL) {
        console.warn(`[client-workflow] legacy unsigned personal link used, clientId=${token}`);
        return { clientId: token, legacy: true };
    }
    return null;
}

/**
 * `base` overrides the default `/bot/book/<id>` URL — pass a slug-resolved
 * `/u/<slug>` URL (see src/lib/booking/slug.ts) at call sites that want the
 * human-readable address (§5.1, O-260829). Omitted, this keeps the id-based
 * link every other caller (reminders, auto-sent messages, mobile API) relies on.
 */
export function clientBookingLink(psychologistId: string, clientId: string, base?: string) {
    const linkBase = base || `${publicBaseUrl()}/bot/book/${psychologistId}`;
    return clientId ? `${linkBase}?c=${personalClientToken(clientId)}` : linkBase;
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
        'ПРАКТИКА не принимает оплату и не подтверждает её поступление. Статус оплаты ведёт специалист.',
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
