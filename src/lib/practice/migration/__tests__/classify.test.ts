import { describe, it, expect } from 'vitest';
import { classifyCalendarEvents, importCandidateDedupeKey, countByReviewState } from '../classify';
import type { PracticeSourceEvent } from '../types';

function event(overrides: Partial<PracticeSourceEvent> = {}): PracticeSourceEvent {
    return {
        provider: 'google',
        integrationId: 'integration-1',
        externalEventId: 'evt-1',
        externalSeriesId: null,
        start: new Date('2026-09-10T06:00:00Z'),
        end: new Date('2026-09-10T06:50:00Z'),
        summary: 'Сессия — Иванова Мария',
        allDay: false,
        date: '2026-09-10',
        startTime: '09:00',
        endTime: '09:50',
        isOwnSession: false,
        ownSessionId: null,
        ...overrides,
    };
}

describe('classifyCalendarEvents (Task 11 review model)', () => {
    it('extracts a client name and produces a stable provider-keyed id', () => {
        const [candidate] = classifyCalendarEvents([event()], [], new Set());
        expect(candidate.proposedClientName).toBe('Иванова Мария');
        expect(candidate.id).toBe('google:integration-1:evt-1');
        expect(candidate.duration).toBe(50);
        expect(candidate.integrationId).toBe('integration-1');
        expect(candidate.externalEventId).toBe('evt-1');
    });

    it('a name-extracted event with no existing client match is session/review, never auto-ready', () => {
        const [candidate] = classifyCalendarEvents([event()], [], new Set());
        expect(candidate.classification).toBe('session');
        expect(candidate.reviewState).toBe('review');
        expect(candidate.resolvedClientId).toBeNull();
        expect(candidate.suggestedClientId).toBeNull();
        expect(candidate.matchReason).toBe('none');
    });

    it('a name-only match against an existing client is ONLY a suggestion — never auto-resolved (founder correction)', () => {
        const [candidate] = classifyCalendarEvents(
            [event({ summary: 'Сессия — Иванова Мария' })],
            [{ id: 'client-1', name: 'иванова мария' }],
            new Set(),
        );
        expect(candidate.reviewState).toBe('review');
        expect(candidate.resolvedClientId).toBeNull();
        expect(candidate.suggestedClientId).toBe('client-1');
        expect(candidate.matchReason).toBe('name_only');
    });

    it('all-day events classify as personal, not session, not skipped', () => {
        const [candidate] = classifyCalendarEvents(
            [event({ allDay: true, summary: 'Отпуск', externalEventId: 'evt-allday' })],
            [], new Set(),
        );
        expect(candidate.classification).toBe('personal');
        expect(candidate.reviewState).toBe('personal');
    });

    it('a recognized personal keyword (extract-name STOP_WORDS) classifies as personal, not uncertain', () => {
        const [candidate] = classifyCalendarEvents([event({ summary: 'Обед', externalEventId: 'evt-lunch' })], [], new Set());
        expect(candidate.classification).toBe('personal');
        expect(candidate.reviewState).toBe('personal');
    });

    it('a timed event that is neither a name nor a recognized personal keyword is uncertain/review, never dropped', () => {
        const [candidate] = classifyCalendarEvents(
            [event({ summary: 'xyz 123', externalEventId: 'evt-unknown' })],
            [], new Set(),
        );
        expect(candidate.classification).toBe('uncertain');
        expect(candidate.reviewState).toBe('review');
        expect(candidate.proposedClientName).toBeNull();
    });

    it('every event produces exactly one candidate — nothing is ever silently dropped', () => {
        const candidates = classifyCalendarEvents(
            [
                event({ externalEventId: 'evt-name' }),
                event({ externalEventId: 'evt-lunch', summary: 'Обед' }),
                event({ externalEventId: 'evt-allday', allDay: true, summary: 'Отпуск' }),
                event({ externalEventId: 'evt-unknown', summary: 'xyz' }),
            ],
            [], new Set(),
        );
        expect(candidates).toHaveLength(4);
    });

    it('flags classification=skipped when an existing session already occupies that date+time+name', () => {
        const key = importCandidateDedupeKey('2026-09-10', '09:00', 'Иванова Мария');
        const [candidate] = classifyCalendarEvents([event()], [], new Set([key]));
        expect(candidate.classification).toBe('skipped');
        expect(candidate.reviewState).toBe('skipped');
    });

    it('is not fooled into skipped by a different date/time/name', () => {
        const key = importCandidateDedupeKey('2026-09-11', '09:00', 'Иванова Мария');
        const [candidate] = classifyCalendarEvents([event()], [], new Set([key]));
        expect(candidate.reviewState).not.toBe('skipped');
    });

    it('countByReviewState tallies the four preview counters', () => {
        const candidates = classifyCalendarEvents(
            [
                event({ externalEventId: 'evt-name' }), // review (name, no match)
                event({ externalEventId: 'evt-lunch', summary: 'Обед' }), // personal
                event({ externalEventId: 'evt-allday', allDay: true, summary: 'Отпуск' }), // personal
            ],
            [], new Set(),
        );
        const counts = countByReviewState(candidates);
        expect(counts).toEqual({ ready: 0, review: 1, personal: 2, skipped: 0 });
    });
});
