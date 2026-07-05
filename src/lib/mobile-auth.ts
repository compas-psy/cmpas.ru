import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import * as crypto from 'crypto';

// NEVER fall back to a constant secret — a known signing key lets anyone forge
// a token for any userId (full account takeover of every psychologist). If
// AUTH_SECRET is somehow unset, use a random per-process key: tokens won't
// survive a restart, but they can't be forged. Loud warning so it's noticed.
const JWT_SECRET = process.env.AUTH_SECRET || (() => {
    console.error('[mobile-auth] AUTH_SECRET is not set — using an ephemeral random key. Mobile tokens will not survive restarts.');
    return crypto.randomBytes(48).toString('hex');
})();
const ACCESS_TOKEN_EXPIRY = 7 * 24 * 60 * 60; // 7 days (mobile)
const REFRESH_TOKEN_EXPIRY = 90 * 24 * 60 * 60; // 90 days

// ── Simple JWT implementation ──
// Using HMAC-SHA256 for simplicity. For production, consider jose library.

interface JwtPayload {
    sub: string;
    role: string;
    exp: number;
    iat: number;
    type: 'access' | 'refresh';
}

function base64urlEncode(data: string): string {
    return Buffer.from(data).toString('base64url');
}

function base64urlDecode(str: string): string {
    return Buffer.from(str, 'base64url').toString('utf-8');
}

export function signJwt(payload: Omit<JwtPayload, 'iat'>): string {
    const header = base64urlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const now = Math.floor(Date.now() / 1000);
    const fullPayload = { ...payload, iat: now };
    const body = base64urlEncode(JSON.stringify(fullPayload));
    const signature = crypto
        .createHmac('sha256', JWT_SECRET)
        .update(`${header}.${body}`)
        .digest('base64url');
    return `${header}.${body}.${signature}`;
}

export function verifyJwt(token: string): JwtPayload | null {
    try {
        const [header, body, signature] = token.split('.');
        if (!header || !body || !signature) return null;
        const expectedSig = crypto
            .createHmac('sha256', JWT_SECRET)
            .update(`${header}.${body}`)
            .digest('base64url');

        // Timing-safe comparison so an attacker can't recover a valid signature
        // byte-by-byte via response-time differences.
        const sigBuf = Buffer.from(signature);
        const expBuf = Buffer.from(expectedSig);
        if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) return null;

        const payload = JSON.parse(base64urlDecode(body)) as JwtPayload;
        if (payload.exp < Math.floor(Date.now() / 1000)) return null;

        return payload;
    } catch {
        return null;
    }
}

export function createTokenPair(userId: string, role: string) {
    const now = Math.floor(Date.now() / 1000);

    const accessToken = signJwt({
        sub: userId,
        role,
        exp: now + ACCESS_TOKEN_EXPIRY,
        type: 'access',
    });

    const refreshToken = signJwt({
        sub: userId,
        role,
        exp: now + REFRESH_TOKEN_EXPIRY,
        type: 'refresh',
    });

    return {
        accessToken,
        refreshToken,
        expiresIn: ACCESS_TOKEN_EXPIRY,
    };
}

/**
 * Extract and verify the JWT Bearer token from a mobile API request.
 * Returns the user ID if valid, null otherwise.
 */
export async function authenticateMobileRequest(
    req: NextRequest
): Promise<{ userId: string; role: string } | null> {
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) return null;

    const token = authHeader.slice(7);
    const payload = verifyJwt(token);

    if (!payload || payload.type !== 'access') return null;

    return { userId: payload.sub, role: payload.role };
}

/**
 * Helper: return 401 if not authenticated.
 */
export function unauthorizedResponse() {
    return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
    );
}
