import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { createTokenPair } from '@/lib/mobile-auth';

const YANDEX_CLIENT_ID = process.env.YANDEX_CLIENT_ID || '';
const YANDEX_CLIENT_SECRET = process.env.YANDEX_CLIENT_SECRET || '';

/**
 * GET /api/mobile/auth/yandex/callback?code=...
 * Yandex redirects here after user authorizes.
 * We exchange code for tokens and redirect to app via deep link.
 */
export async function GET(req: NextRequest) {
    const code = req.nextUrl.searchParams.get('code');

    if (!code) {
        return new NextResponse('Код авторизации не получен', { status: 400 });
    }

    try {
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
            return errorPage('Не удалось авторизоваться через Яндекс');
        }

        const tokenData = await tokenRes.json();

        // Get user info
        const userRes = await fetch('https://login.yandex.ru/info?format=json', {
            headers: { Authorization: `OAuth ${tokenData.access_token}` },
        });

        if (!userRes.ok) {
            return errorPage('Не удалось получить данные пользователя');
        }

        const yandexUser = await userRes.json();
        const email = yandexUser.default_email || yandexUser.emails?.[0];
        const name = yandexUser.display_name || yandexUser.real_name || '';

        if (!email) {
            return errorPage('Яндекс не предоставил email');
        }

        // Find or create user
        let user = await db.user.findUnique({
            where: { email },
            select: { id: true, role: true },
        });

        if (!user) {
            const trialEnd = new Date();
            trialEnd.setDate(trialEnd.getDate() + 30);
            user = await db.user.create({
                data: { email, name, emailVerified: new Date(), trialEndsAt: trialEnd },
                select: { id: true, role: true },
            });
        }

        // Link account
        const existing = await db.account.findFirst({
            where: { userId: user.id, provider: 'yandex' },
        });
        if (!existing) {
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

        // Generate JWT
        const tokens = createTokenPair(user.id, user.role || 'PSYCHOLOGIST');

        // Redirect to app
        const deepLink = `compas://auth/callback?accessToken=${encodeURIComponent(tokens.accessToken)}&refreshToken=${encodeURIComponent(tokens.refreshToken)}&expiresIn=${tokens.expiresIn}`;

        return new NextResponse(
            `<!DOCTYPE html>
            <html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
            <title>Вход в ПРАКТИКУ</title>
            <style>body{font-family:system-ui;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#F7F8F4;color:#142018}
            .card{background:#fff;padding:2rem;border-radius:16px;max-width:400px;text-align:center;box-shadow:0 2px 12px rgba(0,0,0,0.08)}
            h2{color:#1D4735} .btn{display:inline-block;background:#1D4735;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;margin-top:1rem;font-weight:600}
            .spinner{width:40px;height:40px;border:3px solid #E7F0EA;border-top:3px solid #1D4735;border-radius:50%;animation:spin 1s linear infinite;margin:1rem auto}
            @keyframes spin{to{transform:rotate(360deg)}}</style></head>
            <body><div class="card">
            <div class="spinner"></div>
            <h2>Открываем ПРАКТИКУ...</h2>
            <a class="btn" href="${deepLink}">Открыть приложение</a>
            <script>window.location.href="${deepLink}";</script>
            </div></body></html>`,
            { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
        );
    } catch (error) {
        console.error('[mobile/auth/yandex/callback]', error);
        return errorPage('Произошла ошибка при авторизации');
    }
}

function errorPage(message: string) {
    return new NextResponse(
        `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
        <style>body{font-family:system-ui;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#F7F8F4}
        .card{background:#fff;padding:2rem;border-radius:16px;max-width:400px;text-align:center;box-shadow:0 2px 12px rgba(0,0,0,0.08)}
        h2{color:#E35D4F}</style></head>
        <body><div class="card"><h2>Ошибка</h2><p>${message}</p><a href="https://cmpas.ru">На сайт</a></div></body></html>`,
        { status: 400, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    );
}
