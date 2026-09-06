import { describe, it, expect } from 'vitest';
import { practiceImportRange } from '../import-range';

describe('practiceImportRange', () => {
    it('resolves "today" in the practice timezone, not the server local time', () => {
        // 22:30 UTC on 2026-09-10 is already 2026-09-11 in Asia/Yekaterinburg (UTC+5).
        const now = new Date('2026-09-10T22:30:00Z');
        const { start } = practiceImportRange('Asia/Yekaterinburg', now);
        expect(start.toISOString().slice(0, 10)).toBe('2026-09-11');
    });

    it('end date is exactly 180 calendar days after the start date', () => {
        const now = new Date('2026-09-10T12:00:00Z');
        const { start, end } = practiceImportRange('Europe/Moscow', now);

        expect(start.toISOString().slice(0, 10)).toBe('2026-09-10');
        expect(end.toISOString().slice(0, 10)).toBe('2027-03-09'); // 2026-09-10 + 180 days
    });

    it('correctly rolls over a year boundary', () => {
        const now = new Date('2026-12-20T12:00:00Z');
        const { start, end } = practiceImportRange('Europe/Moscow', now);

        expect(start.toISOString().slice(0, 10)).toBe('2026-12-20');
        expect(end.getUTCFullYear()).toBe(2027);
    });

    it('start is midnight UTC-anchored (calendar-date convention), end is end-of-day', () => {
        const now = new Date('2026-09-10T12:00:00Z');
        const { start, end } = practiceImportRange('Europe/Moscow', now);

        expect(start.getUTCHours()).toBe(0);
        expect(start.getUTCMinutes()).toBe(0);
        expect(end.getUTCHours()).toBe(23);
        expect(end.getUTCMinutes()).toBe(59);
    });
});
