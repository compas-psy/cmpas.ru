import { createHmac } from 'crypto';
import { appSecret, safeEqualHex } from '@/lib/app-secret';

const SIGNATURE_DOMAIN = 'practice-slot-v1';

// Task 7 (PRAKTIKA MVP): a slotToken is the ONLY way a booking commit learns
// what it's booking. It encodes the exact resolved option — psychologist,
// date, time, the AvailabilitySlot/ScheduleRule it came from, format,
// address, duration — signed so it can't be edited, and short-lived (15
// minutes from mint) so a stale grid can't be replayed hours later against
// availability that has since changed. createPracticeBooking() never reads
// format/addressId/duration from a separate request field — only from a
// verified token — so a client can't submit a token for one slot but a
// duration/address for another.

const SLOT_TOKEN_PREFIX = 'slt1_';
const SLOT_TOKEN_TTL_MS = 15 * 60 * 1000; // 15 minutes

export interface SlotIdentity {
    psychologistId: string;
    dateStr: string; // "YYYY-MM-DD"
    time: string; // "HH:MM"
    availabilitySlotId: string;
    scheduleRuleId: string | null;
    format: string;
    addressId: string | null;
    duration: number;
}

function serializePayload(identity: SlotIdentity, expiresAt: number): string {
    return [
        identity.psychologistId,
        identity.dateStr,
        identity.time,
        identity.availabilitySlotId,
        identity.scheduleRuleId ?? '',
        identity.format,
        identity.addressId ?? '',
        String(identity.duration),
        String(expiresAt),
    ].join('|');
}

function sign(payload: string): string {
    return createHmac('sha256', appSecret()).update(`${SIGNATURE_DOMAIN}:${payload}`).digest('hex');
}

export function slotToken(identity: SlotIdentity, issuedAt: number = Date.now()): string {
    const expiresAt = issuedAt + SLOT_TOKEN_TTL_MS;
    const payload = serializePayload(identity, expiresAt);
    const sig = sign(payload);
    return SLOT_TOKEN_PREFIX + Buffer.from(`${payload}|${sig}`).toString('base64url');
}

/**
 * Verifies a slotToken and returns the exact slot it was minted for, or
 * `null` if missing, malformed, tampered, expired, or minted for a
 * different psychologist. `psychologistId` is checked BEFORE trusting the
 * signature — the caller's own context decides which psychologist this
 * booking is against, a token can never redirect that.
 */
export function verifySlotToken(psychologistId: string, token: string | null | undefined): SlotIdentity | null {
    if (!token || !token.startsWith(SLOT_TOKEN_PREFIX)) return null;
    try {
        const decoded = Buffer.from(token.slice(SLOT_TOKEN_PREFIX.length), 'base64url').toString('utf8');
        const parts = decoded.split('|');
        if (parts.length !== 10) return null;
        const [tPsy, dateStr, time, availabilitySlotId, scheduleRuleIdRaw, format, addressIdRaw, durationStr, expiresAtStr, sig] = parts;
        if (tPsy !== psychologistId) return null;

        const payload = parts.slice(0, 9).join('|');
        if (!safeEqualHex(sig, sign(payload))) return null;
        if (Date.now() > Number(expiresAtStr)) return null;

        const duration = Number(durationStr);
        if (!Number.isFinite(duration) || duration <= 0) return null;
        if (!dateStr || !time || !availabilitySlotId || !format) return null;

        return {
            psychologistId: tPsy,
            dateStr,
            time,
            availabilitySlotId,
            scheduleRuleId: scheduleRuleIdRaw || null,
            format,
            addressId: addressIdRaw || null,
            duration,
        };
    } catch {
        return null;
    }
}
