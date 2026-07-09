import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db';

export async function GET() {
    const session = await auth();
    // @ts-expect-error role is added in auth session callback
    if (!session?.user?.id || session.user.role !== 'ADMIN') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    try {
        const rows = await db.$queryRaw<Array<{ feature: string; count: bigint; lastInterestAt: Date | null }>>`
            SELECT feature, COUNT(*)::bigint AS count, MAX("createdAt") AS "lastInterestAt"
            FROM "FeatureInterest"
            GROUP BY feature
            ORDER BY count DESC, feature ASC
        `;

        return NextResponse.json({
            items: rows.map((row) => ({
                feature: row.feature,
                count: Number(row.count),
                lastInterestAt: row.lastInterestAt?.toISOString() || null,
            })),
        });
    } catch (error) {
        console.error('[admin/feature-interest GET]', error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
