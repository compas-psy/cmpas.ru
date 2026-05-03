import { NextRequest, NextResponse } from 'next/server';
import { verifyJwt, createTokenPair } from '@/lib/mobile-auth';
import { db } from '@/lib/db';

/**
 * POST /api/mobile/auth/refresh
 * Refresh access token using refresh token.
 * Body: { refreshToken: string }
 */
export async function POST(req: NextRequest) {
    try {
        const { refreshToken } = await req.json();

        if (!refreshToken) {
            return NextResponse.json({ error: 'Refresh token required' }, { status: 400 });
        }

        const payload = verifyJwt(refreshToken);
        if (!payload || payload.type !== 'refresh') {
            return NextResponse.json({ error: 'Invalid refresh token' }, { status: 401 });
        }

        // Verify user still exists
        const user = await db.user.findUnique({
            where: { id: payload.sub },
            select: { id: true, role: true },
        });

        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 401 });
        }

        // Issue new token pair
        const tokens = createTokenPair(user.id, user.role || 'PSYCHOLOGIST');
        return NextResponse.json(tokens);
    } catch (error) {
        console.error('[mobile/auth/refresh]', error);
        return NextResponse.json({ error: 'Token refresh failed' }, { status: 500 });
    }
}
