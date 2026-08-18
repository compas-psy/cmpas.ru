import { describe, it, expect } from 'vitest';
import { isClientLinkExpired } from '@/lib/client-cancellation';

describe('isClientLinkExpired (product/practice/CJM_booking_v1.md §1.3)', () => {
    it('is not expired before the session starts', () => {
        const session = { date: '2026-08-20', time: '19:00', duration: 50 };
        const now = new Date('2026-08-20T15:00:00');
        expect(isClientLinkExpired(session, now)).toBe(false);
    });

    it('is not expired while the session is still in progress', () => {
        const session = { date: '2026-08-20', time: '19:00', duration: 50 };
        const now = new Date('2026-08-20T19:20:00');
        expect(isClientLinkExpired(session, now)).toBe(false);
    });

    it('expires once the session duration has elapsed', () => {
        const session = { date: '2026-08-20', time: '19:00', duration: 50 };
        const now = new Date('2026-08-20T19:51:00');
        expect(isClientLinkExpired(session, now)).toBe(true);
    });

    it('defaults to a 50-minute session when duration is missing', () => {
        const session = { date: '2026-08-20', time: '19:00' };
        expect(isClientLinkExpired(session, new Date('2026-08-20T19:49:00'))).toBe(false);
        expect(isClientLinkExpired(session, new Date('2026-08-20T19:51:00'))).toBe(true);
    });
});
