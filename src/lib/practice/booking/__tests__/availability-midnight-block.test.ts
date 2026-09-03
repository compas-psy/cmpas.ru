// Task 10 (founder review correction) — regression: a busy block derived
// from an event crossing midnight (e.g. an external calendar entry
// 23:00->01:00) must actually block the resolver on BOTH affected days,
// via the two-block split normalizedEventToBusyBlocks produces
// (src/lib/practice/migration/busy-blocks.ts) — never as one nonsensical
// "23:00-01:00" same-day interval that the resolver's
// `currentTotalMins < blockEndMins` check would silently never match past
// midnight.

import { describe, it, expect } from 'vitest';
import { resolveAvailableTimesForDay } from '../availability';
import { normalizedEventToBusyBlocks } from '@/lib/practice/migration/busy-blocks';
import type { PracticeSourceEvent } from '@/lib/practice/migration/types';
import type { AvailabilitySlotInput, ScheduleRuleInput } from '../types';

const MONDAY = '2026-09-07';
const TUESDAY = '2026-09-08';

function rule(): ScheduleRuleInput {
    return {
        id: 'rule-a', format: 'online', addressId: null, duration: 50, breakDuration: 10,
        audienceFilter: 'all', startDate: null, endDate: null,
    };
}

function slot(startTime: string, endTime: string, dayOfWeek: number): AvailabilitySlotInput {
    return {
        id: `slot-${dayOfWeek}-${startTime}`, dayOfWeek, startTime, endTime, duration: null, format: null,
        addressId: null, startDate: null, endDate: null, scheduleRuleId: 'rule-a', scheduleRule: rule(),
    };
}

function crossMidnightEvent(): PracticeSourceEvent {
    return {
        provider: 'google', integrationId: 'integration-1', externalEventId: 'evt-1', externalSeriesId: null,
        start: new Date('2026-09-07T20:00:00Z'), end: new Date('2026-09-07T22:00:00Z'),
        summary: 'Busy', allDay: false,
        date: MONDAY, startTime: '23:00', endTime: '01:00',
        isOwnSession: false, ownSessionId: null,
    };
}

describe('external-busy midnight split feeds the availability resolver correctly (Task 10)', () => {
    it('blocks the tail of Monday (23:00 onward) and the head of Tuesday (until 01:00), leaving the rest of Tuesday open', () => {
        const blocks = normalizedEventToBusyBlocks(crossMidnightEvent());
        expect(blocks).toHaveLength(2);

        // Monday: slot at 22:00-22:50 is BEFORE the 23:00 block — must stay open.
        const mondayBeforeBlock = resolveAvailableTimesForDay({
            dateStr: MONDAY,
            slots: [slot('22:00', '23:00', 0)], // Monday = dayOfWeek 0
            blocks,
            sessions: [],
            settings: { timezone: 'Europe/Moscow', bookingBufferHours: 0, bookingHorizonDays: 365 },
            skipBuffer: true,
        });
        expect(mondayBeforeBlock.map((o) => o.time)).toContain('22:00');

        // Tuesday: the ONLY candidate this narrow window can generate
        // (00:00-00:50) falls fully inside the 00:00-01:00 block — must be excluded.
        const tuesdayDuringBlock = resolveAvailableTimesForDay({
            dateStr: TUESDAY,
            slots: [slot('00:00', '00:50', 1)], // Tuesday = dayOfWeek 1
            blocks,
            sessions: [],
            settings: { timezone: 'Europe/Moscow', bookingBufferHours: 0, bookingHorizonDays: 365 },
            skipBuffer: true,
        });
        expect(tuesdayDuringBlock).toHaveLength(0);

        // ...but a Tuesday slot starting right AFTER the block ends (01:00) must stay open.
        const tuesdayAfterBlock = resolveAvailableTimesForDay({
            dateStr: TUESDAY,
            slots: [slot('01:00', '02:00', 1)],
            blocks,
            sessions: [],
            settings: { timezone: 'Europe/Moscow', bookingBufferHours: 0, bookingHorizonDays: 365 },
            skipBuffer: true,
        });
        expect(tuesdayAfterBlock.map((o) => o.time)).toContain('01:00');
    });
});
