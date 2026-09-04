// Task 13 §6/§7/§8/§22: date/time parsing never guesses ambiguous shapes;
// duration follows the explicit -> end-time-derived -> default fallback
// chain and rejects a real conflict; format normalizes known RU/EN aliases.
import { describe, it, expect } from 'vitest';
import { parseCellDate, parseCellTime, resolveDuration, normalizeFormat } from '../src/lib/practice/migration/spreadsheet/row-parse';

describe('parseCellDate', () => {
    it('accepts ISO YYYY-MM-DD', () => {
        expect(parseCellDate('2026-09-12')).toEqual({ ok: true, date: '2026-09-12' });
    });
    it('accepts DD.MM.YYYY', () => {
        expect(parseCellDate('12.09.2026')).toEqual({ ok: true, date: '2026-09-12' });
    });
    it('accepts a real Excel Date cell (UTC)', () => {
        const d = new Date(Date.UTC(2026, 8, 12));
        expect(parseCellDate(d)).toEqual({ ok: true, date: '2026-09-12' });
    });
    it('rejects an ambiguous slash-separated date rather than guessing', () => {
        expect(parseCellDate('03/04/26')).toEqual({ ok: false, errorCode: 'INVALID_DATE_OR_TIME' });
    });
    it('rejects an impossible calendar date', () => {
        expect(parseCellDate('2026-13-40')).toEqual({ ok: false, errorCode: 'INVALID_DATE_OR_TIME' });
    });
    it('rejects empty/missing', () => {
        expect(parseCellDate(null)).toEqual({ ok: false, errorCode: 'INVALID_DATE_OR_TIME' });
        expect(parseCellDate('')).toEqual({ ok: false, errorCode: 'INVALID_DATE_OR_TIME' });
    });
});

describe('parseCellTime', () => {
    it('accepts HH:MM 24h', () => {
        expect(parseCellTime('15:30')).toEqual({ ok: true, time: '15:30' });
    });
    it('accepts a real Excel time cell', () => {
        const d = new Date(Date.UTC(1899, 11, 30, 15, 0, 0));
        expect(parseCellTime(d)).toEqual({ ok: true, time: '15:00' });
    });
    it('rejects an out-of-range time', () => {
        expect(parseCellTime('25:00')).toEqual({ ok: false, errorCode: 'INVALID_DATE_OR_TIME' });
    });
    it('rejects a non-time string', () => {
        expect(parseCellTime('three pm')).toEqual({ ok: false, errorCode: 'INVALID_DATE_OR_TIME' });
    });
});

describe('resolveDuration', () => {
    it('uses the explicit duration when only it is given', () => {
        expect(resolveDuration({ durationRaw: 45, startTime: '10:00', endTimeRaw: null, defaultDuration: 50 })).toEqual({ ok: true, duration: 45 });
    });
    it('computes duration from end_time when duration is absent', () => {
        expect(resolveDuration({ durationRaw: null, startTime: '10:00', endTimeRaw: '10:50', defaultDuration: 50 })).toEqual({ ok: true, duration: 50 });
    });
    it('falls back to the configured default when neither is given', () => {
        expect(resolveDuration({ durationRaw: null, startTime: '10:00', endTimeRaw: null, defaultDuration: 60 })).toEqual({ ok: true, duration: 60 });
    });
    it('falls back to 50 when no configured default exists either', () => {
        expect(resolveDuration({ durationRaw: null, startTime: '10:00', endTimeRaw: null, defaultDuration: 50 })).toEqual({ ok: true, duration: 50 });
    });
    it('accepts duration and end_time that agree within tolerance', () => {
        expect(resolveDuration({ durationRaw: 50, startTime: '10:00', endTimeRaw: '10:50', defaultDuration: 50 })).toEqual({ ok: true, duration: 50 });
    });
    it('rejects when duration and end_time materially disagree', () => {
        expect(resolveDuration({ durationRaw: 30, startTime: '10:00', endTimeRaw: '11:00', defaultDuration: 50 })).toEqual({ ok: false, errorCode: 'INVALID_DURATION' });
    });
    it('rejects a zero/negative duration', () => {
        expect(resolveDuration({ durationRaw: 0, startTime: '10:00', endTimeRaw: null, defaultDuration: 50 })).toEqual({ ok: false, errorCode: 'INVALID_DURATION' });
    });
    it('rejects an end_time at or before start_time', () => {
        expect(resolveDuration({ durationRaw: null, startTime: '10:00', endTimeRaw: '09:00', defaultDuration: 50 })).toEqual({ ok: false, errorCode: 'INVALID_DURATION' });
    });
});

describe('normalizeFormat', () => {
    it('normalizes recognized offline aliases', () => {
        for (const v of ['offline', 'офлайн', 'очно', 'in person']) expect(normalizeFormat(v)).toBe('offline');
    });
    it('normalizes recognized online aliases', () => {
        for (const v of ['online', 'онлайн', 'remote']) expect(normalizeFormat(v)).toBe('online');
    });
    it('defaults missing/unrecognized to online', () => {
        expect(normalizeFormat(null)).toBe('online');
        expect(normalizeFormat('')).toBe('online');
        expect(normalizeFormat('???')).toBe('online');
    });
});
