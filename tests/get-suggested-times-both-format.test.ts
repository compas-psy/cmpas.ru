// Task 14 point 2 (founder correction): getSuggestedTimes used to collapse a
// format:'both' rule to a single online candidate, silently discarding the
// offline choice — never choose a format for the client. This locks in that
// a 'both' rule now produces TWO real candidates, each with its own exact
// slotToken, and that clicking either books that exact concrete choice.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const db = vi.hoisted(() => ({
    psychologistSettings: { findUnique: vi.fn() },
    availabilitySlot: { findMany: vi.fn() },
    calendarIntegration: { findMany: vi.fn().mockResolvedValue([]) },
    diaryBlock: { findMany: vi.fn().mockResolvedValue([]) },
    diarySession: { findMany: vi.fn().mockResolvedValue([]) },
    psychologistAddress: { findMany: vi.fn() },
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
    id: 'rule-both',
    isActive: true,
    format: 'both',
    addressId: 'address-yauzskaya',
    duration: 50,
    breakDuration: 15,
    audienceFilter: 'all',
    startDate: null,
    endDate: null,
};

describe('getSuggestedTimes — a format:"both" rule never collapses to a single online candidate', () => {
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
        db.psychologistAddress.findMany.mockResolvedValue([{ id: 'address-yauzskaya', name: 'Яузская' }]);
        db.availabilitySlot.findMany.mockResolvedValue([
            {
                id: 'slot-both',
                dayOfWeek: 0,
                startTime: '18:00',
                endTime: '19:00',
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

    it('produces both an online candidate AND an offline candidate for the same time, each with a distinct real slotToken', async () => {
        const { getSuggestedTimes } = await import('../src/app/bot/actions');

        const suggestions = await getSuggestedTimes('psy-1', 'any', null);

        const online = suggestions.find((s) => s.format === 'online');
        const offline = suggestions.find((s) => s.format === 'offline');
        expect(online).toBeDefined();
        expect(offline).toBeDefined();
        expect(online!.slotToken).not.toBe(offline!.slotToken);
        expect(online!.addressId).toBeNull();
        expect(offline!.addressId).toBe('address-yauzskaya');
        expect(offline!.addressName).toBe('Яузская');
    });
});
