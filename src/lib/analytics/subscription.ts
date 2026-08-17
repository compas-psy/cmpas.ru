// MRR tracking (charter/13_TRACKING_PLAN.md §5). Kept separate from the
// Payment/subscriptionEndsAt logic that already drives access control — this
// only mirrors state for measurement and never gates a feature.

import type { PrismaClient } from '@prisma/client';

export interface SubscriptionUpsertInput {
    userId: string;
    plan: string;
    months: number;
    terminal: string;
}

type Db = Pick<PrismaClient, 'subscription'>;

/** Record a successful payment as an active subscription period for MRR. */
export async function recordSubscriptionPayment(db: Db, input: SubscriptionUpsertInput, now: Date = new Date()) {
    const existing = await db.subscription.findUnique({ where: { userId: input.userId } });

    const base = existing && existing.currentPeriodEnd > now ? existing.currentPeriodEnd : now;
    const currentPeriodEnd = new Date(base);
    currentPeriodEnd.setMonth(currentPeriodEnd.getMonth() + input.months);

    return db.subscription.upsert({
        where: { userId: input.userId },
        create: {
            userId: input.userId,
            plan: input.plan,
            status: 'active',
            terminal: input.terminal,
            startedAt: now,
            currentPeriodEnd,
        },
        update: {
            plan: input.plan,
            status: 'active',
            terminal: input.terminal,
            currentPeriodEnd,
        },
    });
}
