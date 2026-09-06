import { createHmac, timingSafeEqual } from 'crypto';

// Verifies Telegram Mini App initData (window.Telegram.WebApp.initData) per
// Telegram's documented algorithm — distinct from the Login Widget's
// (src/lib/telegram-login.ts): the secret key here is itself an HMAC of the
// bot token (key "WebAppData"), not a plain SHA-256 of it, and the
// data-check-string covers every field Telegram sends (not a fixed allow
// list), sorted by key. Without this, a Mini App must trust
// initDataUnsafe.user — a value the client fully controls — for identity.
const TELEGRAM_WEBAPP_HMAC_KEY = 'WebAppData';

export type TelegramWebAppUser = {
    id: number;
    first_name?: string;
    last_name?: string;
    username?: string;
};

export function verifyTelegramWebAppInitData(
    initData: string | null | undefined,
    botToken: string | undefined,
    maxAgeSeconds = 86400,
): TelegramWebAppUser | null {
    if (!initData || !botToken) return null;

    let params: URLSearchParams;
    try {
        params = new URLSearchParams(initData);
    } catch {
        return null;
    }

    const hash = params.get('hash');
    if (!hash) return null;
    params.delete('hash');

    const dataCheckString = Array.from(params.entries())
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([key, value]) => `${key}=${value}`)
        .join('\n');

    const secretKey = createHmac('sha256', TELEGRAM_WEBAPP_HMAC_KEY).update(botToken).digest();
    const expected = createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

    try {
        const expectedBuffer = Buffer.from(expected, 'hex');
        const receivedBuffer = Buffer.from(hash, 'hex');
        if (expectedBuffer.length !== receivedBuffer.length || !timingSafeEqual(expectedBuffer, receivedBuffer)) {
            return null;
        }
    } catch {
        return null;
    }

    const authDate = Number(params.get('auth_date'));
    if (!Number.isFinite(authDate)) return null;
    const now = Math.floor(Date.now() / 1000);
    if (authDate > now + 30 || now - authDate > maxAgeSeconds) return null;

    const userRaw = params.get('user');
    if (!userRaw) return null;
    try {
        const user = JSON.parse(userRaw);
        if (!user || typeof user.id !== 'number') return null;
        return user as TelegramWebAppUser;
    } catch {
        return null;
    }
}
