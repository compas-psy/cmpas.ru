import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { createTokenPair } from '@/lib/mobile-auth';

/**
 * POST /api/mobile/auth/verify
 * Verify magic link token and return JWT access + refresh tokens.
 * Body: { token: string }
 */
export async function POST(req: NextRequest) {
    try {
        const { token } = await req.json();
        const result = await handleVerify(token);
        if ('error' in result) {
            return NextResponse.json({ error: result.error }, { status: result.status });
        }
        return NextResponse.json(result.tokens);
    } catch (error) {
        console.error('[mobile/auth/verify]', error);
        return NextResponse.json({ error: 'Verification failed' }, { status: 500 });
    }
}

/**
 * GET /api/mobile/auth/verify?token=...&email=...
 * Called when user clicks magic link in email.
 * Redirects to the Android app via deep link with tokens.
 */
export async function GET(req: NextRequest) {
    const token = req.nextUrl.searchParams.get('token');
    if (!token) {
        return NextResponse.json({ error: 'Token required' }, { status: 400 });
    }

    const result = await handleVerify(token);

    if ('error' in result) {
        // Show user-friendly error page instead of JSON
        return new NextResponse(
            `<!DOCTYPE html>
            <html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
            <title>КОМПАС</title>
            <style>body{font-family:system-ui;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#F7F8F4;color:#142018}
            .card{background:#fff;padding:2rem;border-radius:16px;max-width:400px;text-align:center;box-shadow:0 2px 12px rgba(0,0,0,0.08)}
            h2{color:#1D4735;margin-bottom:0.5rem} a{color:#1D4735;font-weight:600}</style></head>
            <body><div class="card">
            <h2>Ссылка устарела</h2>
            <p>Эта ссылка для входа уже использована или истекла.</p>
            <p><a href="https://cmpas.ru">Вернуться на сайт</a></p>
            </div></body></html>`,
            { status: 400, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
        );
    }

    const { accessToken, refreshToken, expiresIn } = result.tokens;

    // Return HTML page that:
    // 1. Tries to open the Android app via deep link
    // 2. Falls back to showing tokens for manual entry
    return new NextResponse(
        `<!DOCTYPE html>
        <html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
        <title>Вход в КОМПАС</title>
        <style>
        body{font-family:system-ui;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#F7F8F4;color:#142018}
        .card{background:#fff;padding:2rem;border-radius:16px;max-width:400px;text-align:center;box-shadow:0 2px 12px rgba(0,0,0,0.08)}
        h2{color:#1D4735;margin-bottom:0.5rem}
        .spinner{width:40px;height:40px;border:3px solid #E7F0EA;border-top:3px solid #1D4735;border-radius:50%;animation:spin 1s linear infinite;margin:1rem auto}
        @keyframes spin{to{transform:rotate(360deg)}}
        .btn{display:inline-block;background:#1D4735;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;margin-top:1rem;font-weight:600}
        .fallback{display:none;margin-top:1rem;font-size:0.875rem;color:#5F6C64}
        </style></head>
        <body><div class="card">
        <div class="spinner" id="spinner"></div>
        <h2>Открываем КОМПАС...</h2>
        <p>Если приложение не открылось автоматически:</p>
        <a class="btn" href="compas://auth/callback?accessToken=${encodeURIComponent(accessToken)}&refreshToken=${encodeURIComponent(refreshToken)}&expiresIn=${expiresIn}">
        Открыть приложение</a>
        <div class="fallback" id="fallback">
        <p>Приложение не установлено?</p>
        <a href="https://cmpas.ru">Скачать КОМПАС</a>
        </div>
        <script>
        // Try to open via custom scheme
        window.location.href = "compas://auth/callback?accessToken=${encodeURIComponent(accessToken)}&refreshToken=${encodeURIComponent(refreshToken)}&expiresIn=${expiresIn}";
        // Show fallback after 3 seconds
        setTimeout(function(){
            document.getElementById('spinner').style.display='none';
            document.getElementById('fallback').style.display='block';
        }, 3000);
        </script>
        </div></body></html>`,
        { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    );
}

async function handleVerify(token: string): Promise<
    { tokens: { accessToken: string; refreshToken: string; expiresIn: number } } |
    { error: string; status: number }
> {
    // Find token in DB
    const verificationToken = await db.verificationToken.findFirst({
        where: { token },
    });

    if (!verificationToken) {
        return { error: 'Invalid or expired token', status: 400 };
    }

    if (verificationToken.expires < new Date()) {
        await db.verificationToken.delete({
            where: { identifier_token: { identifier: verificationToken.identifier, token } },
        });
        return { error: 'Token expired', status: 400 };
    }

    // Find or create user
    const email = verificationToken.identifier;
    let user = await db.user.findUnique({
        where: { email },
        select: { id: true, role: true, trialEndsAt: true },
    });

    if (!user) {
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
    return { tokens };
}
