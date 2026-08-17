import { describe, it, expect } from 'vitest';
import { parseRegistryCsv, diffRegistryAgainstPayments, extractUserIdFromOrderId } from '@/lib/analytics/registry-import';

describe('extractUserIdFromOrderId', () => {
    it('extracts the userId out of our own OrderId format', () => {
        expect(extractUserIdFromOrderId('cmpas_abc123_deadbeef01234567')).toBe('abc123');
    });

    it('returns null for anything that does not match the cmpas_<userId>_<hex> shape', () => {
        expect(extractUserIdFromOrderId('some-other-order-id')).toBeNull();
        expect(extractUserIdFromOrderId('cmpas_onlyoneseparator')).toBeNull();
    });
});

describe('parseRegistryCsv', () => {
    it('parses rows keyed by header, defaulting Terminal to site when blank', () => {
        const csv = 'OrderId,PaymentId,Amount,Status,Terminal\ncmpas_u1_aaa,111,99000,CONFIRMED,site\ncmpas_u2_bbb,222,199000,REJECTED,';
        const rows = parseRegistryCsv(csv);
        expect(rows).toHaveLength(2);
        expect(rows[0]).toEqual({ orderId: 'cmpas_u1_aaa', paymentId: '111', amount: 99000, status: 'CONFIRMED', terminal: 'site' });
        expect(rows[1].terminal).toBe('site');
    });

    it('throws when a required column is missing rather than silently guessing', () => {
        expect(() => parseRegistryCsv('OrderId,PaymentId,Amount\ncmpas_u1_aaa,111,99000')).toThrow();
    });
});

describe('diffRegistryAgainstPayments', () => {
    it('only returns rows absent from the known orderId set', () => {
        const registry = [
            { orderId: 'cmpas_u1_aaa', paymentId: '111', amount: 99000, status: 'CONFIRMED', terminal: 'site' },
            { orderId: 'cmpas_u2_bbb', paymentId: '222', amount: 199000, status: 'CONFIRMED', terminal: 'app' },
        ];
        const { toInsert } = diffRegistryAgainstPayments(registry, new Set(['cmpas_u1_aaa']));
        expect(toInsert).toHaveLength(1);
        expect(toInsert[0].orderId).toBe('cmpas_u2_bbb');
        expect(toInsert[0].userId).toBe('u2');
        expect(toInsert[0].status).toBe('paid');
    });

    it('routes rows whose OrderId cannot be decoded to unattributable instead of guessing a userId', () => {
        const registry = [{ orderId: 'legacy-order-42', paymentId: '333', amount: 50000, status: 'CONFIRMED', terminal: 'site' }];
        const { toInsert, unattributable } = diffRegistryAgainstPayments(registry, new Set());
        expect(toInsert).toHaveLength(0);
        expect(unattributable).toHaveLength(1);
    });
});
