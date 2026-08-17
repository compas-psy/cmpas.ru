// Daily T-API reconciliation (charter/13_TRACKING_PLAN.md §4) and the
// one-time historical registry import (§3). Both compare our `Payment` table
// against Tinkoff's own record of operations — the payment provider wins on
// disagreement (charter/03_SOURCES.md §0).
//
// The diff functions here are pure so they're testable without a live T-API
// call or database; the fetch/import wrappers below are thin I/O shells
// around them, used by scripts/reconcile-tinkoff.ts and
// scripts/import-tinkoff-registry.ts.

import { generateToken } from '@/lib/tinkoff';

export interface KnownPayment {
    orderId: string;
    tinkoffPaymentId: string | null;
    amount: number;
    status: string; // pending | paid | failed | cancelled
}

export interface StatementOperation {
    paymentId: string;
    orderId?: string;
    amount: number;
    status: string; // Tinkoff status string, e.g. CONFIRMED
}

export interface ReconciliationResult {
    matched: number;
    missingInStatement: KnownPayment[]; // paid in our DB, absent from the statement
    missingInDb: StatementOperation[]; // present at Tinkoff, unknown to us
    amountMismatches: Array<{ payment: KnownPayment; operation: StatementOperation }>;
}

const STATEMENT_PAID_STATUSES = new Set(['CONFIRMED', 'AUTHORIZED']);

/** Pure diff: our paid payments vs. Tinkoff's statement for the same period. */
export function reconcilePayments(
    payments: KnownPayment[],
    operations: StatementOperation[]
): ReconciliationResult {
    const paidPayments = payments.filter(p => p.status === 'paid');
    const paidOps = operations.filter(op => STATEMENT_PAID_STATUSES.has(op.status));
    const opsByPaymentId = new Map(paidOps.map(op => [op.paymentId, op]));
    const paymentIdsSeen = new Set<string>();

    const missingInStatement: KnownPayment[] = [];
    const amountMismatches: ReconciliationResult['amountMismatches'] = [];
    let matched = 0;

    for (const payment of paidPayments) {
        const op = payment.tinkoffPaymentId ? opsByPaymentId.get(payment.tinkoffPaymentId) : undefined;
        if (!op) {
            missingInStatement.push(payment);
            continue;
        }
        paymentIdsSeen.add(op.paymentId);
        if (op.amount !== payment.amount) {
            amountMismatches.push({ payment, operation: op });
        } else {
            matched++;
        }
    }

    const missingInDb = paidOps.filter(op => !paymentIdsSeen.has(op.paymentId));

    return { matched, missingInStatement, missingInDb, amountMismatches };
}

export interface FetchStatementParams {
    terminalKey: string;
    password: string;
    from: Date;
    to: Date;
}

/** Call Tinkoff's GetStatement (T-API) for one terminal over a date range. */
export async function fetchStatement(p: FetchStatementParams): Promise<StatementOperation[]> {
    const params = {
        TerminalKey: p.terminalKey,
        StartDate: p.from.toISOString().slice(0, 10),
        EndDate: p.to.toISOString().slice(0, 10),
    };
    const token = generateToken(params, p.password);

    const res = await fetch('https://securepay.tinkoff.ru/v2/GetStatement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...params, Token: token }),
    });
    const data = await res.json();

    if (!data.Success) {
        throw new Error(`[Tinkoff GetStatement] ${data.Message || data.Details || 'unknown error'}`);
    }

    const operations: Array<{ PaymentId: unknown; OrderId?: unknown; Amount: unknown; Status: unknown }> = data.Statement ?? [];
    return operations.map(op => ({
        paymentId: String(op.PaymentId),
        orderId: op.OrderId ? String(op.OrderId) : undefined,
        amount: Number(op.Amount),
        status: String(op.Status),
    }));
}
