// Client consent (152-FZ), channel-agnostic (O-260817-09, legal/CLIENT_CONSENT_BASIS.md).
//
// A client can reach the booking page via Telegram WebApp (real, stable
// telegramUserId), via a personal link opened in a browser or MAX (a known
// DiaryClient.id but no per-channel identity), or as a brand-new visitor with
// neither. Consent has to attach to the DiaryClient row itself, not to
// whichever of those happened to be available at the time — that's the bug
// this module fixes: the old checkConsentRequired/saveConsent only knew how
// to key off telegramUserId, so every non-Telegram client was asked for
// consent on every visit and had nowhere real to save it.
import { createHash } from 'crypto';
import type { PrismaClient } from '@prisma/client';

export type Db = Pick<PrismaClient, 'consentVersion' | 'diaryClient' | 'telegramClient'>;

export type ConsentIdentity = {
    clientId?: string | null;
    telegramUserId?: string | null;
};

export type ConsentStatus = { required: boolean; text: string; version: string };

type ConsentFields = {
    consentVersion?: string | null;
    consentDate?: Date | null;
    consentRevokedAt?: Date | null;
};

const PSYCHOLOGIST_NAME_PLACEHOLDER = '{psychologistName}';

/** Substitutes the one per-psychologist variable the shared template carries.
 * Full per-psychologist consent text is a separate, larger task (legal pack §2) — out of scope here. */
export function renderConsentText(template: string, psychologistName: string) {
    return template.split(PSYCHOLOGIST_NAME_PLACEHOLDER).join(psychologistName || 'специалист');
}

/** Pure predicate so the frontend gate (getConsentStatus) and the server-side
 * gate (bookSession) can never drift apart on what counts as valid consent. */
export function isConsentSatisfied(client: ConsentFields | null | undefined, activeVersion: string): boolean {
    if (!client?.consentVersion || client.consentVersion !== activeVersion) return false;
    if (client.consentRevokedAt && (!client.consentDate || client.consentDate <= client.consentRevokedAt)) return false;
    return true;
}

/** Finds the DiaryClient a consent action is about, the same way regardless of
 * which identity the current channel happens to provide. */
export async function resolveClientForIdentity(db: Db, psychologistId: string, identity: ConsentIdentity) {
    if (identity.clientId) {
        const byId = await db.diaryClient.findFirst({ where: { id: identity.clientId, psychologistId } });
        if (byId) return byId;
    }
    if (identity.telegramUserId) {
        const byChat = await db.diaryClient.findFirst({ where: { psychologistId, telegramChatId: identity.telegramUserId } });
        if (byChat) return byChat;

        // Client hasn't booked with this psychologist yet, but their Telegram
        // account is already linked to a DiaryClient with a different
        // psychologist. That link doesn't establish consent here.
        const tgClient = await db.telegramClient.findUnique({
            where: { telegramUserId: identity.telegramUserId },
            include: { diaryClient: true },
        });
        if (tgClient?.diaryClient && tgClient.diaryClient.psychologistId === psychologistId) return tgClient.diaryClient;
    }
    return null;
}

export async function getConsentStatus(
    db: Db,
    psychologistId: string,
    identity: ConsentIdentity,
    psychologistName: string
): Promise<ConsentStatus> {
    const active = await db.consentVersion.findFirst({ where: { isActive: true }, orderBy: { createdAt: 'desc' } });
    if (!active) return { required: false, text: '', version: '' };

    const text = renderConsentText(active.text, psychologistName);
    const client = await resolveClientForIdentity(db, psychologistId, identity);
    if (isConsentSatisfied(client, active.version)) {
        return { required: false, text, version: active.version };
    }

    // Telegram-only fallback: consent given on a first bot interaction, before
    // any DiaryClient existed at all (mirrors the pre-existing sync-on-booking
    // behaviour in bookSession()).
    if (!client && identity.telegramUserId) {
        const tgClient = await db.telegramClient.findUnique({ where: { telegramUserId: identity.telegramUserId } });
        if (tgClient?.consentGiven) return { required: false, text, version: active.version };
    }

    return { required: true, text, version: active.version };
}

/** Records consent against whichever client identity resolves right now.
 * `pending: true` means neither a clientId nor a telegramUserId was
 * available (a brand-new anonymous browser/MAX visitor) — nothing could be
 * written yet. The caller must re-apply it via attachPendingConsent() once
 * bookSession() resolves/creates the DiaryClient by phone. */
export async function recordConsent(
    db: Db,
    psychologistId: string,
    identity: ConsentIdentity,
    consentVersion: string,
    now: Date = new Date()
) {
    const client = await resolveClientForIdentity(db, psychologistId, identity);
    const hashSubject = identity.clientId || identity.telegramUserId || 'anonymous';
    const consentHash = createHash('sha256').update(`${hashSubject}:${consentVersion}:${now.toISOString()}`).digest('hex');

    if (client) {
        await db.diaryClient.update({ where: { id: client.id }, data: { consentVersion, consentHash, consentDate: now } });
    }

    if (identity.telegramUserId) {
        const tgClient = await db.telegramClient.upsert({
            where: { telegramUserId: identity.telegramUserId },
            update: { consentGiven: true, consentDate: now },
            create: { telegramUserId: identity.telegramUserId, consentGiven: true, consentDate: now },
        });
        if (!client && tgClient.diaryClientId) {
            await db.diaryClient.update({ where: { id: tgClient.diaryClientId }, data: { consentVersion, consentHash, consentDate: now } });
        }
    }

    return { hash: consentHash, timestamp: now.toISOString(), pending: !client && !identity.telegramUserId };
}

/** Client-initiated revoke (CJM_booking_v2.md §7, point 4 of O-260817-09).
 * consentVersion/consentHash/consentDate are left untouched — the history of
 * what was agreed to stays on the record; only future bookings are gated
 * (see isConsentSatisfied, used by bookSession's server-side check). */
export async function revokeConsent(db: Db, clientId: string, now: Date = new Date()) {
    return db.diaryClient.update({ where: { id: clientId }, data: { consentRevokedAt: now } });
}

/** Applies a consent accepted earlier in the same request (recordConsent's
 * `pending: true` case) onto the DiaryClient bookSession() just resolved or
 * created by phone number. */
export async function attachPendingConsent(db: Db, clientId: string, consentVersion: string, now: Date = new Date()) {
    const consentHash = createHash('sha256').update(`${clientId}:${consentVersion}:${now.toISOString()}`).digest('hex');
    await db.diaryClient.update({ where: { id: clientId }, data: { consentVersion, consentHash, consentDate: now } });
    return { hash: consentHash };
}
