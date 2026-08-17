// Daily T-API reconciliation (charter/13_TRACKING_PLAN.md §4). Run manually
// or from an operator-controlled schedule — this repo does not wire it into
// an automatic cron job, since a discrepancy here is a P0 for CDO that a
// human should see, not something that silently self-heals.
//
// Usage: npx tsx scripts/reconcile-tinkoff.ts [YYYY-MM-DD]  (defaults to yesterday)

import { PrismaClient } from '@prisma/client';
import { fetchStatement, reconcilePayments } from '../src/lib/analytics/reconciliation';

const db = new PrismaClient();

async function main() {
    const dateArg = process.argv[2];
    const to = dateArg ? new Date(dateArg) : new Date(Date.now() - 24 * 60 * 60 * 1000);
    const from = new Date(to);

    const terminalKey = process.env.TINKOFF_TERMINAL_KEY;
    const password = process.env.TINKOFF_PASSWORD;
    if (!terminalKey || !password) {
        throw new Error('TINKOFF_TERMINAL_KEY / TINKOFF_PASSWORD not set');
    }

    const payments = await db.payment.findMany({
        where: { createdAt: { gte: from, lte: to } },
        select: { orderId: true, tinkoffPaymentId: true, amount: true, status: true },
    });

    const operations = await fetchStatement({ terminalKey, password, from, to });
    const result = reconcilePayments(payments, operations);

    console.log(`[reconcile] ${from.toISOString().slice(0, 10)}: matched=${result.matched}`);
    if (result.missingInStatement.length) {
        console.warn('[reconcile] paid in DB, absent from statement:', result.missingInStatement);
    }
    if (result.missingInDb.length) {
        console.warn('[reconcile] present at Tinkoff, unknown to us:', result.missingInDb);
    }
    if (result.amountMismatches.length) {
        console.warn('[reconcile] amount mismatches:', result.amountMismatches);
    }
}

main()
    .catch(e => { console.error(e); process.exitCode = 1; })
    .finally(() => db.$disconnect());
