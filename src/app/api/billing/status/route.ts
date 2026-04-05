import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db';

export async function GET() {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const rows = await db.$queryRaw<{
            trialEndsAt: Date | null;
            subscriptionEndsAt: Date | null;
            subscriptionPlan: string | null;
        }[]>`
            SELECT "trialEndsAt", "subscriptionEndsAt", "subscriptionPlan"
            FROM "User" WHERE id = ${session.user.id} LIMIT 1
        `;
        const user = rows[0];
        if (!user) return NextResponse.json({ daysLeft: null, isExpired: false, isForever: false, subscriptionEndsAt: null, subscriptionPlan: null });

        const now = new Date();
        const trialEndsAt = user.trialEndsAt ? new Date(user.trialEndsAt) : null;
        const subscriptionEndsAt = user.subscriptionEndsAt ? new Date(user.subscriptionEndsAt) : null;

        const isForever = trialEndsAt && trialEndsAt.getFullYear() >= 2099;
        const hasActiveSub = subscriptionEndsAt && subscriptionEndsAt > now;

        const effectiveEnd = hasActiveSub ? subscriptionEndsAt : trialEndsAt;
        const isExpired = effectiveEnd ? effectiveEnd < now : false;
        const daysLeft = effectiveEnd
            ? Math.max(0, Math.ceil((effectiveEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
            : null;

        return NextResponse.json({
            daysLeft: isForever ? null : daysLeft,
            isExpired: isForever ? false : isExpired,
            isForever: !!isForever,
            subscriptionEndsAt: subscriptionEndsAt ? subscriptionEndsAt.toISOString() : null,
            subscriptionPlan: user.subscriptionPlan,
        });
    } catch {
        return NextResponse.json({ daysLeft: null, isExpired: false, isForever: false, subscriptionEndsAt: null, subscriptionPlan: null });
    }
}
