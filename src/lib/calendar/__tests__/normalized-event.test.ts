import { describe, it, expect } from 'vitest';
import { resolveWallClockParts } from '../normalized-event';

describe('resolveWallClockParts', () => {
    it('resolves an absolute UTC instant against the given timezone, not the server local time', () => {
        // 21:00 UTC on 2026-09-01 is 00:00 the NEXT day in Europe/Moscow (UTC+3).
        const instant = new Date('2026-09-01T21:00:00Z');
        const result = resolveWallClockParts(instant, 'Europe/Moscow');
        expect(result).toEqual({ date: '2026-09-02', time: '00:00' });
    });

    it('a floating (no-timezone) local time uses its literal digits verbatim, never converted', () => {
        const instant = new Date('2026-09-01T15:00:00Z'); // irrelevant — localStr wins
        const result = resolveWallClockParts(instant, 'Europe/Moscow', '2026-09-01T09:30:00');
        expect(result).toEqual({ date: '2026-09-01', time: '09:30' });
    });

    it('handles a UTC midnight instant correctly in a timezone that pushes it to the previous day', () => {
        // 00:30 UTC on 2026-09-02 is 2026-09-01 20:30 in America/New_York (UTC-4 in September, DST).
        const instant = new Date('2026-09-02T00:30:00Z');
        const result = resolveWallClockParts(instant, 'America/New_York');
        expect(result).toEqual({ date: '2026-09-01', time: '20:30' });
    });
});
