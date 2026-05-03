import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { createTokenPair } from '@/lib/mobile-auth';

/**
 * POST /api/mobile/auth/verify
 * Verify magic link token and return JWT access + refresh tokens.
 * Body: { token: string }
 * Also supports GET with ?token=...&email=... for direct link clicks.
 */
export async function POST(req: NextRequest) {
    try {
        const { token } = await req.json();
        return handleVerify(token);
    } catch (error) {
        console.error('[mobile/auth/verify]', error);
        return NextResponse.json({ error: 'Verification failed' }, { status: 500 });
    }
}

export async function GET(req: NextRequest) {
    const token = req.nextUrl.searchParams.get('token');
    if (!token) {
        return NextResponse.json({ error: 'Token required' }, { status: 400 });
    }
    return handleVerify(token);
}

async function handleVerify(token: string) {
    // Find token in DB
    const verificationToken = await db.verificationToken.findFirst({
        where: { token },
    });

    if (!verificationToken) {
        return NextResponse.json({ error: 'Invalid or expired token' }, { status: 400 });
    }

    if (verificationToken.expires < new Date()) {
        // Cleanup expired token
        await db.verificationToken.delete({
            where: { identifier_token: { identifier: verificationToken.identifier, token } },
        });
        return NextResponse.json({ error: 'Token expired' }, { status: 400 });
    }

    // Find or create user
    const email = verificationToken.identifier;
    let user = await db.user.findUnique({
        where: { email },
        select: { id: true, role: true, trialEndsAt: true },
    });

    if (!user) {
        // Create new user with 30-day trial
        const trialEnd = new Date();
        trialEnd.setDate(trialEnd.getDate() + 30);

        user = await db.user.create({
            data: {
                email,
                emailVerified: new Date(),
                trialEndsAt: trialEnd,
            },
            select: { id: true, role: true, trialEndsAt: true },
        });
    }

    // Delete used token
    await db.verificationToken.delete({
        where: { identifier_token: { identifier: email, token } },
    });

    // Generate JWT tokens
    const tokens = createTokenPair(user.id, user.role || 'PSYCHOLOGIST');

    return NextResponse.json(tokens);
}
