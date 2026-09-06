import { describe, it, expect } from 'vitest';
import { normalizedEventToBusyBlocks } from '../busy-blocks';
import type { PracticeSourceEvent } from '../types';

function baseEvent(overrides: Partial<PracticeSourceEvent> = {}): PracticeSourceEvent {
    return {
        provider: 'google',
        integrationId: 'integration-1',
        externalEventId: 'evt-1',
        externalSeriesId: null,
        start: new Date('2026-09-10T06:00:00Z'),
        end: new Date('2026-09-10T06:50:00Z'),
        summary: 'Busy',
        allDay: false,
        date: '2026-09-10',
        startTime: '09:00',
        endTime: '09:50',
        isOwnSession: false,
        ownSessionId: null,
        ...overrides,
    };
}

function utcDateStr(d: Date): string {
    return d.toISOString().slice(0, 10);
}

describe('normalizedEventToBusyBlocks', () => {
    it('a same-day timed event produces exactly one block', () => {
        const blocks = normalizedEventToBusyBlocks(baseEvent());
        expect(blocks).toHaveLength(1);
        expect(utcDateStr(blocks[0].date)).toBe('2026-09-10');
        expect(blocks[0]).toMatchObject({ startTime: '09:00', endTime: '09:50' });
    });

    it('a timed event crossing midnight (23:00 -> 01:00) splits into two blocks, never one negative interval', () => {
        const event = baseEvent({ date: '2026-09-10', startTime: '23:00', endTime: '01:00' });
        const blocks = normalizedEventToBusyBlocks(event);

        expect(blocks).toHaveLength(2);
        expect(utcDateStr(blocks[0].date)).toBe('2026-09-10');
        expect(blocks[0]).toMatchObject({ startTime: '23:00', endTime: '24:00' });
        expect(utcDateStr(blocks[1].date)).toBe('2026-09-11');
        expect(blocks[1]).toMatchObject({ startTime: '00:00', endTime: '01:00' });
    });

    it('a midnight-crossing event correctly rolls over a month boundary', () => {
        const event = baseEvent({ date: '2026-09-30', startTime: '23:30', endTime: '00:30' });
        const blocks = normalizedEventToBusyBlocks(event);

        expect(blocks).toHaveLength(2);
        expect(utcDateStr(blocks[0].date)).toBe('2026-09-30');
        expect(utcDateStr(blocks[1].date)).toBe('2026-10-01');
    });

    it('a single-day all-day event produces one 00:00-24:00 block on its date', () => {
        const event = baseEvent({
            allDay: true,
            start: new Date(Date.UTC(2026, 8, 10)), // 2026-09-10
            end: new Date(Date.UTC(2026, 8, 11)), // exclusive boundary
            date: '2026-09-10', startTime: '00:00', endTime: '00:00',
        });
        const blocks = normalizedEventToBusyBlocks(event);

        expect(blocks).toHaveLength(1);
        expect(utcDateStr(blocks[0].date)).toBe('2026-09-10');
        expect(blocks[0]).toMatchObject({ startTime: '00:00', endTime: '24:00' });
    });

    it('a multi-day all-day event (3-day vacation) produces one full-day block PER affected day', () => {
        const event = baseEvent({
            allDay: true,
            start: new Date(Date.UTC(2026, 8, 10)), // 2026-09-10
            end: new Date(Date.UTC(2026, 8, 13)), // exclusive — covers 10, 11, 12
            date: '2026-09-10', startTime: '00:00', endTime: '00:00',
        });
        const blocks = normalizedEventToBusyBlocks(event);

        expect(blocks).toHaveLength(3);
        expect(blocks.map((b) => utcDateStr(b.date))).toEqual(['2026-09-10', '2026-09-11', '2026-09-12']);
        for (const block of blocks) {
            expect(block).toMatchObject({ startTime: '00:00', endTime: '24:00' });
        }
    });

    it('a malformed zero-length all-day event still blocks its one start day', () => {
        const event = baseEvent({
            allDay: true,
            start: new Date(Date.UTC(2026, 8, 10)),
            end: new Date(Date.UTC(2026, 8, 10)), // same as start — degenerate
            date: '2026-09-10', startTime: '00:00', endTime: '00:00',
        });
        const blocks = normalizedEventToBusyBlocks(event);
        expect(blocks).toHaveLength(1);
        expect(utcDateStr(blocks[0].date)).toBe('2026-09-10');
    });
});
