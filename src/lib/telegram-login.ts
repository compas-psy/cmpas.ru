import { createHash, createHmac, timingSafeEqual } from 'crypto';

export type TelegramLoginPayload = {
    id: string;
    first_name?: string;
    last_name?: string;
    username?: string;
    photo_url?: string;
    auth_date: string;
    hash: string;
};

const ALLOWED_FIELDS = ['auth_date', 'first_name', 'id', 'last_name', 'photo_url', 'username'] as const;

export function verifyTelegramLoginPayload(
    payload: TelegramLoginPayload,
    botToken: string,
    maxAgeSeconds = 600,
) {
    if (!payload.id || !payload.auth_date || !payload.hash) return false;

    const authDate = Number(payload.auth_date);
    if (!Number.isFinite(authDate)) return false;
    const now = Math.floor(Date.now() / 1000);
    if (authDate > now + 30 || now - authDate > maxAgeSeconds) return false;

    const dataCheckString = ALLOWED_FIELDS
        .filter(key => payload[key] !== undefined && payload[key] !== '')
        .sort()
        .map(key => `${key}=${payload[key]}`)
        .join('\n');

    const secretKey = createHash('sha256').update(botToken).digest();
    const expected = createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

    try {
        const expectedBuffer = Buffer.from(expected, 'hex');
        const receivedBuffer = Buffer.from(payload.hash, 'hex');
        return expectedBuffer.length === receivedBuffer.length && timingSafeEqual(expectedBuffer, receivedBuffer);
    } catch {
        return false;
    }
}
