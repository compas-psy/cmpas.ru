// One-time historical registry import (charter/13_TRACKING_PLAN.md §3). Only
// creates Payment rows that don't already exist — never overwrites a row the
// webhook receiver already wrote. Run once against the full-history export
// from the Tinkoff personal cabinet, then compare totals before trusting it.
//
// Usage: npx tsx scripts/import-tinkoff-registry.ts <path-to-registry.csv>

import { readFileSync } from 'fs';
import { PrismaClient } from '@prisma/client';
import { parseRegistryCsv, diffRegistryAgainstPayments } from '../src/lib/analytics/registry-import';

const db = new PrismaClient();

// The registry doesn't carry our internal plan enum (practice/practice_plus)
// — only OrderId, which decodes to a userId, not a plan. Rows land with this
// placeholder; someone with the Description column from the original export
// fixes it by hand. Reconciliation cares about the sum, not the plan label.
const UNKNOWN_PLAN = 'unknown';

async function main() {
    const csvPath = process.argv[2];
    if (!csvPath) throw new Error('usage: import-tinkoff-registry.ts <path-to-registry.csv>');

    const registry = parseRegistryCsv(readFileSync(csvPath, 'utf8'));
    const existing = await db.payment.findMany({ select: { orderId: true } });
    const { toInsert, unattributable } = diffRegistryAgainstPayments(registry, new Set(existing.map(p => p.orderId)));

    console.log(`[import] registry rows: ${registry.length}, missing from Payment: ${toInsert.length + unattributable.length}`);

    if (unattributable.length) {
        console.warn(`[import] ${unattributable.length} rows have an OrderId we can't decode to a userId — skipped, needs manual review:`, unattributable);
    }

    let inserted = 0;
    for (const row of toInsert) {
        try {
            await db.payment.create({
                data: {
                    orderId: row.orderId,
                    userId: row.userId,
                    tinkoffPaymentId: row.tinkoffPaymentId,
                    amount: row.amount,
                    status: row.status,
                    plan: UNKNOWN_PLAN,
                    terminal: row.terminal,
                },
            });
            inserted++;
            console.log(`[import] inserted orderId=${row.orderId} userId=${row.userId} amount=${row.amount} status=${row.status}`);
        } catch (e) {
            // Most likely a decoded userId that no longer exists (deleted account) —
            // one bad row shouldn't abort the rest of the import.
            console.error(`[import] failed orderId=${row.orderId} userId=${row.userId}:`, e);
        }
    }

    console.log(`[import] done — inserted ${inserted}/${toInsert.length}, skipped ${unattributable.length} unattributable.`);
}

main()
    .catch(e => { console.error(e); process.exitCode = 1; })
    .finally(() => db.$disconnect());
