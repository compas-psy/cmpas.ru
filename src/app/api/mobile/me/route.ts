import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateMobileRequest, unauthorizedResponse } from '@/lib/mobile-auth';

/**
 * GET /api/mobile/me
 * Returns current user profile.
 */
export async function GET(req: NextRequest) {
    const auth = await authenticateMobileRequest(req);
    if (!auth) return unauthorizedResponse();

    try {
        const user = await db.user.findUnique({
            where: { id: auth.userId },
            select: {
                id: true,
                name: true,
                email: true,
                image: true,
                role: true,
                analyticsConsentAt: true,
            },
        });

        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        return NextResponse.json({
            id: user.id,
            name: user.name,
            email: user.email,
            role: (user.role || 'PSYCHOLOGIST').toUpperCase(),
            avatarUrl: user.image,
            analyticsConsentAt: user.analyticsConsentAt ? user.analyticsConsentAt.toISOString() : null,
        });
    } catch (error) {
        console.error('[mobile/me]', error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
