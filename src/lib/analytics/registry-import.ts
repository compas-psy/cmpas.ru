// One-time historical registry import (charter/13_TRACKING_PLAN.md §3):
// backfill Payment rows for operations that predate the webhook receiver or
// that Tinkoff never successfully notified us about.
//
// Expected CSV columns (from Tinkoff's personal-cabinet registry export):
// OrderId,PaymentId,Amount,Status,Terminal — Amount in kopecks, Status one of
// Tinkoff's raw status strings (CONFIRMED, REJECTED, ...), Terminal one of
// "site"/"app". The exact column set should be checked against a real export
// before running this for real; the parser rejects anything that doesn't
// match rather than guessing.

export interface RegistryRow {
    orderId: string;
    paymentId: string;
    amount: number;
    status: string;
    terminal: string;
}

const STATUS_MAP: Record<string, string> = {
    CONFIRMED: 'paid',
    AUTHORIZED: 'paid',
    REJECTED: 'failed',
    REVERSED: 'cancelled',
    REFUNDED: 'cancelled',
    PARTIAL_REFUNDED: 'cancelled',
    DEADLINE_EXPIRED: 'failed',
    CANCELED: 'cancelled',
};

export function parseRegistryCsv(csvText: string): RegistryRow[] {
    const lines = csvText.trim().split('\n').filter(Boolean);
    if (lines.length === 0) return [];

    const header = lines[0].split(',').map(h => h.trim());
    const required = ['OrderId', 'PaymentId', 'Amount', 'Status', 'Terminal'];
    for (const col of required) {
        if (!header.includes(col)) {
            throw new Error(`[registry-import] missing required column: ${col}`);
        }
    }

    return lines.slice(1).map(line => {
        const cells = line.split(',').map(c => c.trim());
        const row: Record<string, string> = {};
        header.forEach((col, i) => { row[col] = cells[i]; });
        return {
            orderId: row.OrderId,
            paymentId: row.PaymentId,
            amount: Number(row.Amount),
            status: row.Status,
            terminal: row.Terminal || 'site',
        };
    });
}

/**
 * Our own OrderId encodes the userId: `cmpas_<userId>_<random hex>`
 * (src/app/api/payments/create/route.ts). The registry doesn't carry a
 * separate customer column we can rely on, so this is how we attribute a
 * historical row to an account without guessing.
 */
export function extractUserIdFromOrderId(orderId: string): string | null {
    const parts = orderId.split('_');
    if (parts.length !== 3 || parts[0] !== 'cmpas') return null;
    return parts[1] || null;
}

export interface MissingPaymentRow {
    orderId: string;
    userId: string;
    tinkoffPaymentId: string;
    amount: number;
    status: string;
    terminal: string;
}

export interface RegistryDiff {
    toInsert: MissingPaymentRow[];
    unattributable: RegistryRow[]; // missing from Payment, but orderId doesn't decode to a userId
}

/** Rows present in the Tinkoff registry but not yet in our Payment table. */
export function diffRegistryAgainstPayments(
    registry: RegistryRow[],
    knownOrderIds: Set<string>
): RegistryDiff {
    const missing = registry.filter(row => !knownOrderIds.has(row.orderId));
    const toInsert: MissingPaymentRow[] = [];
    const unattributable: RegistryRow[] = [];

    for (const row of missing) {
        const userId = extractUserIdFromOrderId(row.orderId);
        if (!userId) {
            unattributable.push(row);
            continue;
        }
        toInsert.push({
            orderId: row.orderId,
            userId,
            tinkoffPaymentId: row.paymentId,
            amount: row.amount,
            status: STATUS_MAP[row.status] ?? 'failed',
            terminal: row.terminal,
        });
    }

    return { toInsert, unattributable };
}
