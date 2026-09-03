import { createHash, randomUUID, timingSafeEqual } from 'crypto';

// Shared signing secret for every HMAC-based token this app issues
// (session-action links, personal client links, slot tokens, ...). Ephemeral
// random fallback instead of a known constant: a public/well-known fallback
// would let anyone forge any of these tokens if AUTH_SECRET were ever unset.
// Random fallback makes forged tokens impossible (existing links break on
// restart — the safe failure mode) and is scoped per-process, which is fine:
// every token type here is signed and verified within the same process's
// lifetime (tokens expire in minutes to weeks, not across deploys).
let _ephemeralSecret: string | undefined;
export function appSecret() {
    const s = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
    if (s) return s;
    if (!_ephemeralSecret) {
        console.error('[app-secret] AUTH_SECRET is not set — using an ephemeral key; signed links will not survive restarts.');
        _ephemeralSecret = createHash('sha256').update(randomUUID() + randomUUID()).digest('hex');
    }
    return _ephemeralSecret;
}

export function safeEqualHex(a: string, b: string) {
    const ba = Buffer.from(a);
    const bb = Buffer.from(b);
    return ba.length === bb.length && timingSafeEqual(ba, bb);
}
