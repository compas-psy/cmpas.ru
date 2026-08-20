import { describe, it, expect } from 'vitest';
import { buildSessionIcs, sanitizeSessionTitle, DEFAULT_SESSION_TITLE } from '@/lib/calendar/client-ics';

describe('sanitizeSessionTitle (product/practice/CJM_booking_v1.md §1.3)', () => {
    it('falls back to the neutral default when no title is given', () => {
        expect(sanitizeSessionTitle(undefined)).toBe(DEFAULT_SESSION_TITLE);
        expect(sanitizeSessionTitle(null)).toBe(DEFAULT_SESSION_TITLE);
        expect(sanitizeSessionTitle('')).toBe(DEFAULT_SESSION_TITLE);
        expect(sanitizeSessionTitle('   ')).toBe(DEFAULT_SESSION_TITLE);
    });

    it('keeps a client-chosen title as-is', () => {
        expect(sanitizeSessionTitle('Встреча с тренером')).toBe('Встреча с тренером');
    });

    it('collapses newlines and repeated whitespace into single spaces', () => {
        expect(sanitizeSessionTitle('Личная\nвстреча   ')).toBe('Личная встреча');
    });

    it('truncates to 100 characters', () => {
        const long = 'A'.repeat(150);
        expect(sanitizeSessionTitle(long)).toHaveLength(100);
    });
});

describe('buildSessionIcs (product/practice/CJM_booking_v1.md §1.3)', () => {
    const now = new Date('2026-08-18T10:00:00Z');

    it('uses the neutral default title when the client did not type one', () => {
        const ics = buildSessionIcs(
            { date: '2026-08-20', time: '19:00', duration: 50 },
            { uid: 'session-1@cmpas.ru', now }
        );
        expect(ics).toContain('SUMMARY:Личная встреча');
    });

    it('uses the client-chosen title', () => {
        const ics = buildSessionIcs(
            { date: '2026-08-20', time: '19:00', duration: 50 },
            { title: 'Разговор с коучем', uid: 'session-1@cmpas.ru', now }
        );
        expect(ics).toContain('SUMMARY:Разговор с коучем');
    });

    it('never reveals what the specialist\'s Google Calendar summary would say', () => {
        const ics = buildSessionIcs(
            { date: '2026-08-20', time: '19:00', duration: 50 },
            { uid: 'session-1@cmpas.ru', now }
        );
        expect(ics).not.toMatch(/психолог/i);
        expect(ics).not.toMatch(/сессия/i);
    });

    it('computes DTEND from duration when endTime is not stored', () => {
        const ics = buildSessionIcs(
            { date: '2026-08-20', time: '19:00', duration: 50 },
            { uid: 'session-1@cmpas.ru', now }
        );
        expect(ics).toContain('DTSTART;TZID=Europe/Moscow:20260820T190000');
        expect(ics).toContain('DTEND;TZID=Europe/Moscow:20260820T195000');
    });

    it('prefers the stored endTime over recomputing from duration', () => {
        const ics = buildSessionIcs(
            { date: '2026-08-20', time: '19:00', duration: 50, endTime: '19:55' },
            { uid: 'session-1@cmpas.ru', now }
        );
        expect(ics).toContain('DTEND;TZID=Europe/Moscow:20260820T195500');
    });

    it('defaults to a 50-minute session when duration is missing', () => {
        const ics = buildSessionIcs(
            { date: '2026-08-20', time: '19:00' },
            { uid: 'session-1@cmpas.ru', now }
        );
        expect(ics).toContain('DTEND;TZID=Europe/Moscow:20260820T195000');
    });

    it('escapes commas and semicolons in a client-chosen title', () => {
        const ics = buildSessionIcs(
            { date: '2026-08-20', time: '19:00', duration: 50 },
            { title: 'Встреча; личное, важное', uid: 'session-1@cmpas.ru', now }
        );
        expect(ics).toContain('SUMMARY:Встреча\\; личное\\, важное');
    });

    it('carries a deterministic UID so re-downloading does not create a duplicate event', () => {
        const ics = buildSessionIcs(
            { date: '2026-08-20', time: '19:00', duration: 50 },
            { uid: 'session-abc123@cmpas.ru', now }
        );
        expect(ics).toContain('UID:session-abc123@cmpas.ru');
    });

    it('produces a well-formed VCALENDAR/VEVENT block', () => {
        const ics = buildSessionIcs(
            { date: '2026-08-20', time: '19:00', duration: 50 },
            { uid: 'session-1@cmpas.ru', now }
        );
        expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
        expect(ics).toContain('BEGIN:VEVENT');
        expect(ics).toContain('END:VEVENT');
        expect(ics.trimEnd().endsWith('END:VCALENDAR')).toBe(true);
    });
});
