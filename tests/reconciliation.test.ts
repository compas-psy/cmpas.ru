import { describe, it, expect } from 'vitest';
import { reconcilePayments, KnownPayment, StatementOperation } from '@/lib/analytics/reconciliation';

describe('reconcilePayments (charter/13_TRACKING_PLAN.md §4)', () => {
    it('matches a paid payment against a confirmed statement operation with the same amount', () => {
        const payments: KnownPayment[] = [{ orderId: 'o1', tinkoffPaymentId: 'p1', amount: 1000, status: 'paid' }];
        const operations: StatementOperation[] = [{ paymentId: 'p1', amount: 1000, status: 'CONFIRMED' }];

        const result = reconcilePayments(payments, operations);
        expect(result.matched).toBe(1);
        expect(result.missingInStatement).toHaveLength(0);
        expect(result.missingInDb).toHaveLength(0);
        expect(result.amountMismatches).toHaveLength(0);
    });

    it('flags a paid payment absent from the statement', () => {
        const payments: KnownPayment[] = [{ orderId: 'o1', tinkoffPaymentId: 'p1', amount: 1000, status: 'paid' }];
        const result = reconcilePayments(payments, []);
        expect(result.missingInStatement).toHaveLength(1);
    });

    it('flags a statement operation unknown to us, per the priority rule that the provider wins', () => {
        const result = reconcilePayments([], [{ paymentId: 'p1', amount: 1000, status: 'CONFIRMED' }]);
        expect(result.missingInDb).toHaveLength(1);
    });

    it('flags an amount mismatch instead of silently accepting either number', () => {
        const payments: KnownPayment[] = [{ orderId: 'o1', tinkoffPaymentId: 'p1', amount: 1000, status: 'paid' }];
        const operations: StatementOperation[] = [{ paymentId: 'p1', amount: 990, status: 'CONFIRMED' }];

        const result = reconcilePayments(payments, operations);
        expect(result.amountMismatches).toHaveLength(1);
        expect(result.matched).toBe(0);
    });

    it('ignores payments that never reached paid status', () => {
        const payments: KnownPayment[] = [{ orderId: 'o1', tinkoffPaymentId: null, amount: 1000, status: 'failed' }];
        const result = reconcilePayments(payments, []);
        expect(result.missingInStatement).toHaveLength(0);
    });

    it('ignores non-paid statement operations (e.g. REJECTED)', () => {
        const result = reconcilePayments([], [{ paymentId: 'p1', amount: 1000, status: 'REJECTED' }]);
        expect(result.missingInDb).toHaveLength(0);
    });
});
