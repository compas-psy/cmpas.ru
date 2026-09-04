// Task 13 §12/§13/§22: the fingerprint is computed from normalized semantic
// fields, never raw text — differently formatted phone numbers must produce
// the SAME fingerprint, and it must be deterministic across calls.
import { describe, it, expect } from 'vitest';
import { computeSourceFingerprint, computeClientKey } from '../src/lib/practice/migration/spreadsheet/fingerprint';

describe('computeClientKey', () => {
    it('prioritizes phone over email/name', () => {
        expect(computeClientKey({ phone: '+7 900 000-00-01', email: 'x@y.com', name: 'Иван' })).toBe(computeClientKey({ phone: '89000000001', email: 'other@z.com', name: 'Другой' }));
    });
    it('falls back to email when no phone', () => {
        expect(computeClientKey({ phone: null, email: 'A@B.com', name: 'Иван' })).toBe(computeClientKey({ phone: null, email: 'a@b.com', name: 'Другой' }));
    });
    it('falls back to normalized name when neither phone nor email exist', () => {
        expect(computeClientKey({ phone: null, email: null, name: '  Иван   Иванов ' })).toBe(computeClientKey({ phone: null, email: null, name: 'иван иванов' }));
    });
    it('different phones produce different keys — same name is not enough to merge', () => {
        expect(computeClientKey({ phone: '+79000000001', email: null, name: 'Иван Иванов' }))
            .not.toBe(computeClientKey({ phone: '+79000000002', email: null, name: 'Иван Иванов' }));
    });
});

describe('computeSourceFingerprint', () => {
    const base = { clientKey: 'phone:+79000000001', date: '2026-09-12', startTime: '15:00', duration: 50, format: 'online' as const };

    it('is deterministic for identical semantic input', () => {
        expect(computeSourceFingerprint(base)).toBe(computeSourceFingerprint({ ...base }));
    });
    it('changes when the date changes', () => {
        expect(computeSourceFingerprint(base)).not.toBe(computeSourceFingerprint({ ...base, date: '2026-09-13' }));
    });
    it('changes when the client key changes', () => {
        expect(computeSourceFingerprint(base)).not.toBe(computeSourceFingerprint({ ...base, clientKey: 'phone:+79000000002' }));
    });
    it('is a 64-char hex SHA-256 digest', () => {
        expect(computeSourceFingerprint(base)).toMatch(/^[0-9a-f]{64}$/);
    });
});
