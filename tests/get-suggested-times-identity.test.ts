// Task 7 (PRAKTIKA MVP, founder review before Task 7 started): getSuggestedTimes
// used to collapse resolveAvailableTimesForDay's rich slot (availabilitySlotId,
// scheduleRuleId, duration) back down to the old bare {date,time,format,addressId}
// shape — losing exact-slot identity before it ever reached the client. A
// signed slotToken can't be built from a candidate that no longer says which
// rule/slot it came from. This locks in that every SuggestedTimeCandidate
// carries the same exact-slot identity the full calendar (getAvailableTimes)
// returns — one shared contract, not two.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const db = vi.hoisted(() => ({
    psychologistSettings: {
        findUnique: vi.fn(),
    },
    availabilitySlot: {
        findMany: vi.fn(),
    },
    calendarIntegration: {
        findMany: vi.fn().mockResolvedValue([]),
    },
    diaryBlock: {
        findMany: vi.fn().mockResolvedValue([]),
    },
    diarySession: {
        findMany: vi.fn().mockResolvedValue([]),
    },
}));
vi.mock('@/lib/db', () => ({ db }));

vi.mock('@/lib/calendar/google', () => ({ fetchGoogleCalendarEvents: vi.fn() }));
vi.mock('@/lib/calendar/yandex', () => ({ fetchYandexCalendarEvents: vi.fn() }));
vi.mock('@/lib/telegram', () => ({ sendTelegramMessage: vi.fn() }));
vi.mock('@/lib/max-bot', () => ({ sendMaxMessage: vi.fn() }));
vi.mock('@/lib/notifications', () => ({ createNotification: vi.fn() }));
vi.mock('@/lib/client-workflow', () => ({
    resolvePersonalClientToken: vi.fn(),
    resolveSignedPersonalClientToken: vi.fn(),
    personalClientToken: vi.fn(),
}));
vi.mock('@/lib/telegram-webapp', () => ({ verifyTelegramWebAppInitData: vi.fn() }));

const RULE = {
    id: 'rule-evening',
    isActive: true,
    format: 'offline',
    addressId: 'address-yauzskaya',
    duration: 50,
    breakDuration: 15,
    audienceFilter: 'all',
    startDate: null,
    endDate: null,
};

describe('getSuggestedTimes — exact-slot identity survives the collapse to SuggestedTimeCandidate', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        db.psychologistSettings.findUnique.mockResolvedValue({
            scheduleMode: 'booking',
            timezone: 'Europe/Moscow',
            bookingBufferHours: 0,
            bookingHorizonDays: 60,
            maxSessionsPerDay: null,
            sessionBreak: 15,
            blockConflicts: false,
        });
        db.calendarIntegration.findMany.mockResolvedValue([]);
        db.diaryBlock.findMany.mockResolvedValue([]);
        db.diarySession.findMany.mockResolvedValue([]);
        // A single Monday evening offline rule — matches any weekday scan.
        db.availabilitySlot.findMany.mockResolvedValue([
            {
                id: 'slot-evening',
                dayOfWeek: 0,
                startTime: '15:00',
                endTime: '21:00',
                duration: null,
                format: null,
                addressId: null,
                startDate: null,
                endDate: null,
                scheduleRuleId: RULE.id,
                scheduleRule: RULE,
            },
        ]);
    });

    it('every suggested candidate carries availabilitySlotId, scheduleRuleId and duration', async () => {
        const { getSuggestedTimes } = await import('../src/app/bot/actions');

        const suggestions = await getSuggestedTimes('psy-1', 'any', null);

        expect(suggestions.length).toBeGreaterThan(0);
        for (const s of suggestions) {
            expect(s.availabilitySlotId).toBe('slot-evening');
            expect(s.scheduleRuleId).toBe('rule-evening');
            expect(s.duration).toBe(50);
        }
    });
});
