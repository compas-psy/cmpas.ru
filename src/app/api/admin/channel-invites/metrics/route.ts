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
        const rows = await db.$queryRaw<Array<{
            channel: string;
            invited: bigint;
            linked: bigint;
            expired: bigint;
            active: bigint;
        }>>`
            SELECT
                channel,
                COUNT(*)::bigint AS invited,
                COUNT(*) FILTER (WHERE "usedAt" IS NOT NULL)::bigint AS linked,
                COUNT(*) FILTER (WHERE "usedAt" IS NULL AND "expiresAt" <= NOW())::bigint AS expired,
                COUNT(*) FILTER (WHERE "usedAt" IS NULL AND "expiresAt" > NOW())::bigint AS active
            FROM "ClientInviteToken"
            GROUP BY channel
            ORDER BY channel ASC
        `;

        const total = rows.reduce((acc, row) => acc + Number(row.invited), 0);
        const linked = rows.reduce((acc, row) => acc + Number(row.linked), 0);

        return NextResponse.json({
            total,
            linked,
            conversion: total ? Math.round((linked / total) * 1000) / 10 : 0,
            items: rows.map((row) => ({
                channel: row.channel,
                invited: Number(row.invited),
                linked: Number(row.linked),
                expired: Number(row.expired),
                active: Number(row.active),
                conversion: Number(row.invited) ? Math.round((Number(row.linked) / Number(row.invited)) * 1000) / 10 : 0,
            })),
        });
    } catch (error) {
        console.error('[admin/channel-invites/metrics GET]', error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
