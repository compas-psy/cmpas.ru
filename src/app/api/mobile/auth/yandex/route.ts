import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { createTokenPair } from '@/lib/mobile-auth';

const YANDEX_CLIENT_ID = process.env.YANDEX_CLIENT_ID || '';
const YANDEX_CLIENT_SECRET = process.env.YANDEX_CLIENT_SECRET || '';

/**
 * POST /api/mobile/auth/yandex
 * Exchange Yandex OAuth code for app JWT tokens.
 * Body: { code: string }
 */
export async function POST(req: NextRequest) {
    try {
        const { code } = await req.json();
        if (!code) {
            return NextResponse.json({ error: 'Code required' }, { status: 400 });
        }

        // Exchange code for Yandex access token
        const tokenRes = await fetch('https://oauth.yandex.ru/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                grant_type: 'authorization_code',
                code,
                client_id: YANDEX_CLIENT_ID,
                client_secret: YANDEX_CLIENT_SECRET,
            }),
        });

        if (!tokenRes.ok) {
            const err = await tokenRes.text();
            console.error('[mobile/auth/yandex] Token exchange failed:', err);
            return NextResponse.json({ error: 'Yandex auth failed' }, { status: 400 });
        }

        const tokenData = await tokenRes.json();

        // Get user info from Yandex
        const userRes = await fetch('https://login.yandex.ru/info?format=json', {
            headers: { Authorization: `OAuth ${tokenData.access_token}` },
        });

        if (!userRes.ok) {
            return NextResponse.json({ error: 'Failed to get user info' }, { status: 400 });
        }

        const yandexUser = await userRes.json();
        const email = yandexUser.default_email || yandexUser.emails?.[0];
        const name = yandexUser.display_name || yandexUser.real_name || '';

        if (!email) {
            return NextResponse.json({ error: 'No email from Yandex' }, { status: 400 });
        }

        // Find or create user + link Yandex account
        let user = await db.user.findUnique({
            where: { email },
            select: { id: true, role: true },
        });

        if (!user) {
            const trialEnd = new Date();
            trialEnd.setDate(trialEnd.getDate() + 30);

            user = await db.user.create({
                data: {
                    email,
                    name,
                    emailVerified: new Date(),
                    trialEndsAt: trialEnd,
                },
                select: { id: true, role: true },
            });
        }

        // Link Yandex account if not already linked
        const existingAccount = await db.account.findFirst({
            where: { userId: user.id, provider: 'yandex' },
        });

        if (!existingAccount) {
            await db.account.create({
                data: {
                    userId: user.id,
                    type: 'oauth',
                    provider: 'yandex',
                    providerAccountId: String(yandexUser.id),
                    access_token: tokenData.access_token,
                    refresh_token: tokenData.refresh_token,
                    token_type: 'bearer',
                },
            });
        }

        // Generate app JWT tokens
        const tokens = createTokenPair(user.id, user.role || 'PSYCHOLOGIST');
        return NextResponse.json(tokens);
    } catch (error) {
        console.error('[mobile/auth/yandex]', error);
        return NextResponse.json({ error: 'Auth failed' }, { status: 500 });
    }
}

/**
 * GET /api/mobile/auth/yandex
 * Returns Yandex OAuth URL for mobile app to open in browser.
 */
export async function GET() {
    const redirectUri = 'https://cmpas.ru/api/mobile/auth/yandex/callback';
    const url = `https://oauth.yandex.ru/authorize?response_type=code&client_id=${YANDEX_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&force_confirm=yes`;
    return NextResponse.json({ url });
}
