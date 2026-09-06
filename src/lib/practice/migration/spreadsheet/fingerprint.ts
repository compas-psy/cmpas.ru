// Task 13 §13: a spreadsheet/paste session row has no CalendarSessionLink to
// anchor idempotency to, so it needs its own durable source identity. The
// raw row text must NOT be that identity — whitespace, quoting and phone
// formatting can change across a re-export of the same spreadsheet without
// the row actually changing — so the fingerprint is computed from the
// normalized SEMANTIC fields the row resolved to.
import { createHash } from 'crypto';
export { computeClientKey } from '@/lib/clients/identity-key';

export interface FingerprintInput {
    clientKey: string;
    date: string;
    startTime: string;
    duration: number;
    format: 'online' | 'offline';
    addressKey?: string | null;
}

export function computeSourceFingerprint(input: FingerprintInput): string {
    const raw = [
        'spreadsheet',
        input.clientKey,
        input.date,
        input.startTime,
        String(input.duration),
        input.format,
        (input.addressKey ?? '').trim().toLowerCase(),
    ].join('|');
    return createHash('sha256').update(raw).digest('hex');
}
