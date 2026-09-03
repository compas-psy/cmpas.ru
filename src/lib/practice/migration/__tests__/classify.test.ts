import { describe, it, expect } from 'vitest';
import { classifyCalendarEvents, importCandidateDedupeKey } from '../classify';
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

describe('classifyCalendarEvents (Task 11)', () => {
    it('extracts a client name and produces a candidate with a stable provider-keyed id', () => {
        const [candidate] = classifyCalendarEvents([event()], [], new Set());
        expect(candidate.clientName).toBe('Иванова Мария');
        expect(candidate.id).toBe('google:integration-1:evt-1');
        expect(candidate.duration).toBe(50);
    });

    it('rejects events extract-name.ts cannot turn into a client name (classification)', () => {
        const candidates = classifyCalendarEvents([event({ summary: 'Обед', externalEventId: 'evt-lunch' })], [], new Set());
        expect(candidates).toHaveLength(0);
    });

    it('excludes all-day events entirely — never an import candidate', () => {
        const candidates = classifyCalendarEvents(
            [event({ allDay: true, summary: 'Отпуск', externalEventId: 'evt-allday' })],
            [], new Set(),
        );
        expect(candidates).toHaveLength(0);
    });

    it('matches an existing client case-insensitively and exposes matchedClientId', () => {
        const [candidate] = classifyCalendarEvents(
            [event({ summary: 'Сессия — Иванова Мария' })],
            // Client card was typed lower-case by hand — matching must not care.
            [{ id: 'client-1', name: 'иванова мария' }],
            new Set(),
        );
        expect(candidate.matchedClientId).toBe('client-1');
    });

    it('leaves matchedClientId null for a name with no existing client', () => {
        const [candidate] = classifyCalendarEvents([event()], [{ id: 'client-1', name: 'Другой Клиент' }], new Set());
        expect(candidate.matchedClientId).toBeNull();
    });

    it('flags duplicate=true when an existing session already occupies that date+time+name', () => {
        const key = importCandidateDedupeKey('2026-09-10', '09:00', 'Иванова Мария');
        const [candidate] = classifyCalendarEvents([event()], [], new Set([key]));
        expect(candidate.duplicate).toBe(true);
    });

    it('is not fooled into a duplicate by a different date/time/name', () => {
        const key = importCandidateDedupeKey('2026-09-11', '09:00', 'Иванова Мария');
        const [candidate] = classifyCalendarEvents([event()], [], new Set([key]));
        expect(candidate.duplicate).toBe(false);
    });

    it('produces one candidate per event, even for repeat occurrences of the same client name (no aggregation/minCount)', () => {
        const candidates = classifyCalendarEvents(
            [
                event({ externalEventId: 'evt-1', date: '2026-09-10' }),
                event({ externalEventId: 'evt-2', date: '2026-09-17' }),
            ],
            [], new Set(),
        );
        expect(candidates).toHaveLength(2);
    });
});
