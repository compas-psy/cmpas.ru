import { NextRequest, NextResponse } from 'next/server';
import { authenticateMobileRequest, unauthorizedResponse } from '@/lib/mobile-auth';
import { listNotifications, markNotificationsRead } from '@/lib/notifications';

/**
 * GET /api/mobile/notifications?cursor=<id>&limit=20
 * Paginated notification feed, newest first.
 */
export async function GET(req: NextRequest) {
    const auth = await authenticateMobileRequest(req);
    if (!auth) return unauthorizedResponse();

    const cursor = req.nextUrl.searchParams.get('cursor') || undefined;
    const limitParam = req.nextUrl.searchParams.get('limit');
    const limit = limitParam ? Number(limitParam) : undefined;

    try {
        const { items, nextCursor } = await listNotifications(auth.userId, { cursor, limit });
        return NextResponse.json({
            items: items.map(n => ({
                id: n.id,
                type: n.type,
                title: n.title,
                subtitle: n.subtitle,
                sessionId: n.sessionId,
                clientId: n.clientId,
                createdAt: n.createdAt.toISOString(),
                unread: n.readAt === null,
            })),
            nextCursor,
        });
    } catch (error) {
        console.error('[mobile/notifications GET]', error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}

/**
 * POST /api/mobile/notifications
 * Body: { ids?: string[] } — marks the given ids read, or all if omitted.
 */
export async function POST(req: NextRequest) {
    const auth = await authenticateMobileRequest(req);
    if (!auth) return unauthorizedResponse();

    try {
        const body = await req.json().catch(() => ({}));
        const ids = Array.isArray(body?.ids) ? body.ids.filter((id: unknown) => typeof id === 'string') : undefined;
        await markNotificationsRead(auth.userId, ids);
        return NextResponse.json({ ok: true });
    } catch (error) {
        console.error('[mobile/notifications POST]', error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
