// Task 10 (founder review correction): an all-day event is never imported
// as a client session by default (Task 11's classification job), but with
// blockConflicts=true it must still block the whole day's availability —
// for BOTH providers. fetchExternalBusyBlocks now runs every normalized
// event through normalizedEventToBusyBlocks (src/lib/practice/migration/
// busy-blocks.ts), which expands an all-day event into a full 00:00-24:00
// block for each day it covers.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resolveAvailableTimesForDay } from '../src/lib/practice/booking/availability';
import type { AvailabilitySlotInput, ScheduleRuleInput } from '../src/lib/practice/booking/types';

const calendarIntegrationFindMany = vi.fn();
vi.mock('@/lib/db', () => ({
    db: { calendarIntegration: { findMany: (...args: unknown[]) => calendarIntegrationFindMany(...args) } },
}));

const fetchGoogleCalendarEvents = vi.fn();
vi.mock('@/lib/calendar/google', () => ({
    fetchGoogleCalendarEvents: (...args: unknown[]) => fetchGoogleCalendarEvents(...args),
}));
const fetchYandexCalendarEvents = vi.fn();
vi.mock('@/lib/calendar/yandex', () => ({
    fetchYandexCalendarEvents: (...args: unknown[]) => fetchYandexCalendarEvents(...args),
}));

const DAY = '2026-09-10'; // Thursday
const DAY_OF_WEEK = 3; // Mon=0 -> Thursday=3

function rule(): ScheduleRuleInput {
    return { id: 'rule-a', format: 'online', addressId: null, duration: 50, breakDuration: 10, audienceFilter: 'all', startDate: null, endDate: null };
}
function slot(): AvailabilitySlotInput {
    return { id: 'slot-a', dayOfWeek: DAY_OF_WEEK, startTime: '09:00', endTime: '18:00', duration: null, format: null, addressId: null, startDate: null, endDate: null, scheduleRuleId: 'rule-a', scheduleRule: rule() };
}

function allDayEvent(provider: 'google' | 'yandex') {
    return {
        provider, integrationId: 'integration-1', externalEventId: 'evt-vacation', externalSeriesId: null,
        start: new Date(Date.UTC(2026, 8, 10)), end: new Date(Date.UTC(2026, 8, 11)),
        summary: 'Отпуск', allDay: true,
        date: DAY, startTime: '00:00', endTime: '00:00',
        isOwnSession: false, ownSessionId: null,
    };
}

describe('all-day events block the whole day\'s availability (Task 10)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('Google all-day "отпуск" makes the whole day unavailable', async () => {
        calendarIntegrationFindMany.mockResolvedValue([{ id: 'integration-1', provider: 'google' }]);
        fetchGoogleCalendarEvents.mockResolvedValue({ success: true, events: [allDayEvent('google')] });

        const { fetchExternalBusyBlocks } = await import('../src/lib/practice/booking/external-busy');
        const blocks = await fetchExternalBusyBlocks('psy-1', new Date('2026-09-10'), new Date('2026-09-10'), { timezone: 'Europe/Moscow' });

        expect(blocks).toHaveLength(1);
        expect(blocks[0]).toMatchObject({ startTime: '00:00', endTime: '24:00' });

        const resolved = resolveAvailableTimesForDay({
            dateStr: DAY, slots: [slot()], blocks, sessions: [],
            settings: { timezone: 'Europe/Moscow', bookingBufferHours: 0, bookingHorizonDays: 365 },
            skipBuffer: true,
        });
        expect(resolved).toHaveLength(0);
    });

    it('Yandex all-day "отпуск" makes the whole day unavailable', async () => {
        calendarIntegrationFindMany.mockResolvedValue([{ id: 'integration-1', provider: 'yandex' }]);
        fetchYandexCalendarEvents.mockResolvedValue({ success: true, events: [allDayEvent('yandex')] });

        const { fetchExternalBusyBlocks } = await import('../src/lib/practice/booking/external-busy');
        const blocks = await fetchExternalBusyBlocks('psy-1', new Date('2026-09-10'), new Date('2026-09-10'), { timezone: 'Europe/Moscow' });

        expect(blocks).toHaveLength(1);
        expect(blocks[0]).toMatchObject({ startTime: '00:00', endTime: '24:00' });

        const resolved = resolveAvailableTimesForDay({
            dateStr: DAY, slots: [slot()], blocks, sessions: [],
            settings: { timezone: 'Europe/Moscow', bookingBufferHours: 0, bookingHorizonDays: 365 },
            skipBuffer: true,
        });
        expect(resolved).toHaveLength(0);
    });
});
