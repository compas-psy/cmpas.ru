import { describe, it, expect, vi, beforeEach } from 'vitest';

const findFirst = {
    diaryClient: vi.fn(),
    diarySession: vi.fn(),
    psychologistAddress: vi.fn(),
    calendarIntegration: vi.fn(),
    scheduleRule: vi.fn(),
    availabilitySlot: vi.fn(),
};

vi.mock('@/lib/db', () => ({
    db: {
        diaryClient: { findFirst: (...args: unknown[]) => findFirst.diaryClient(...args) },
        diarySession: { findFirst: (...args: unknown[]) => findFirst.diarySession(...args) },
        psychologistAddress: { findFirst: (...args: unknown[]) => findFirst.psychologistAddress(...args) },
        calendarIntegration: { findFirst: (...args: unknown[]) => findFirst.calendarIntegration(...args) },
        scheduleRule: { findFirst: (...args: unknown[]) => findFirst.scheduleRule(...args) },
        availabilitySlot: { findFirst: (...args: unknown[]) => findFirst.availabilitySlot(...args) },
    },
}));

const {
    requireOwnedClient,
    requireOwnedSession,
    requireOwnedAddress,
    requireOwnedCalendarIntegration,
    requireOwnedScheduleRule,
    requireOwnedAvailabilitySlot,
    OwnershipError,
} = await import('../ownership');

describe('Task 1: ownership guards', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    const cases = [
        { name: 'client', fn: requireOwnedClient, model: findFirst.diaryClient },
        { name: 'session', fn: requireOwnedSession, model: findFirst.diarySession },
        { name: 'address', fn: requireOwnedAddress, model: findFirst.psychologistAddress },
        { name: 'calendar integration', fn: requireOwnedCalendarIntegration, model: findFirst.calendarIntegration },
        { name: 'schedule rule', fn: requireOwnedScheduleRule, model: findFirst.scheduleRule },
        { name: 'availability slot', fn: requireOwnedAvailabilitySlot, model: findFirst.availabilitySlot },
    ];

    for (const { name, fn, model } of cases) {
        it(`${name}: resolves when owned by the caller`, async () => {
            model.mockResolvedValue({ id: 'resource-1' });
            await expect(fn('psy-a', 'resource-1')).resolves.toBeUndefined();
            expect(model).toHaveBeenCalledWith({
                where: { id: 'resource-1', psychologistId: 'psy-a' },
                select: { id: true },
            });
        });

        it(`${name}: rejects with an indistinguishable "not found" when owned by someone else`, async () => {
            model.mockResolvedValue(null);
            await expect(fn('psy-a', 'resource-of-b')).rejects.toBeInstanceOf(OwnershipError);
        });
    }
});
