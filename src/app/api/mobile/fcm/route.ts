import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateMobileRequest, unauthorizedResponse } from '@/lib/mobile-auth';

/**
 * POST /api/mobile/fcm
 * Register or update FCM push token for the authenticated user.
 * Body: { token: string }
 */
export async function POST(req: NextRequest) {
    const auth = await authenticateMobileRequest(req);
    if (!auth) return unauthorizedResponse();

    try {
        const { token } = await req.json();
        if (!token || typeof token !== 'string') {
            return NextResponse.json({ error: 'token required' }, { status: 400 });
        }

        await db.user.update({
            where: { id: auth.userId },
            data: { fcmToken: token },
        });

        return NextResponse.json({ ok: true });
    } catch (error) {
        console.error('[mobile/fcm POST]', error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}

/**
 * DELETE /api/mobile/fcm
 * Remove FCM token (on logout).
 */
export async function DELETE(req: NextRequest) {
    const auth = await authenticateMobileRequest(req);
    if (!auth) return unauthorizedResponse();

    try {
        await db.user.update({
            where: { id: auth.userId },
            data: { fcmToken: null },
        });
        return NextResponse.json({ ok: true });
    } catch (error) {
        console.error('[mobile/fcm DELETE]', error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
