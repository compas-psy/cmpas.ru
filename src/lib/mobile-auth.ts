import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import * as crypto from 'crypto';

const JWT_SECRET = process.env.AUTH_SECRET || 'fallback-secret';
const ACCESS_TOKEN_EXPIRY = 15 * 60; // 15 minutes
const REFRESH_TOKEN_EXPIRY = 30 * 24 * 60 * 60; // 30 days

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
        const expectedSig = crypto
            .createHmac('sha256', JWT_SECRET)
            .update(`${header}.${body}`)
            .digest('base64url');

        if (signature !== expectedSig) return null;

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
