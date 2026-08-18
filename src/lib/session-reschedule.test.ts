import { describe, expect, it, vi, beforeEach } from 'vitest';

const { findUnique, findMany, update } = vi.hoisted(() => ({
    findUnique: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
    db: { diarySession: { findUnique, findMany, update } },
}));

vi.mock('@/lib/calendar/auto-sync', () => ({
    autoSyncSessionToCalendars: vi.fn().mockResolvedValue(undefined),
    autoDeleteSessionFromCalendars: vi.fn().mockResolvedValue(undefined),
}));

const { rescheduleSessionAtomic, RescheduleConflictError } = await import('./session-reschedule');

const PSYCHOLOGIST_ID = 'psy-1';
const SESSION_ID = 'session-1';

function existingSession(overrides: Partial<Record<string, unknown>> = {}) {
    return {
        id: SESSION_ID,
        psychologistId: PSYCHOLOGIST_ID,
        clientId: 'client-1',
        status: 'confirmed',
        duration: 50,
        ...overrides,
    };
}

describe('rescheduleSessionAtomic', () => {
    beforeEach(() => {
        findUnique.mockReset();
        findMany.mockReset();
        update.mockReset();
    });

    it('updates the existing row in place when the new slot is free', async () => {
        findUnique
            .mockResolvedValueOnce(existingSession()) // ownership lookup
            .mockResolvedValueOnce({ ...existingSession(), client: { name: 'Клиент' } }); // post-update refetch for calendar sync
        findMany.mockResolvedValueOnce([]); // no other sessions that day
        update.mockResolvedValueOnce({ ...existingSession(), date: new Date('2026-09-01'), time: '11:00', endTime: '11:50' });

        const result = await rescheduleSessionAtomic(PSYCHOLOGIST_ID, SESSION_ID, new Date('2026-09-01'), '11:00');

        expect(update).toHaveBeenCalledTimes(1);
        expect(update).toHaveBeenCalledWith({
            where: { id: SESSION_ID },
            data: { date: new Date('2026-09-01'), time: '11:00', endTime: '11:50', notified24h: false, notified1h: false },
        });
        expect(result.time).toBe('11:00');
    });

    it('refuses to move onto a slot occupied by another session, and never writes', async () => {
        findUnique.mockResolvedValueOnce(existingSession());
        findMany.mockResolvedValueOnce([
            { id: 'other-session', time: '11:00', duration: 50 },
        ]);

        await expect(rescheduleSessionAtomic(PSYCHOLOGIST_ID, SESSION_ID, new Date('2026-09-01'), '11:00'))
            .rejects.toBeInstanceOf(RescheduleConflictError);

        // The client's original booking must remain exactly as it was — no
        // partial state where the old slot is gone but the new one failed.
        expect(update).not.toHaveBeenCalled();
    });

    it('refuses to reschedule a session that belongs to a different psychologist', async () => {
        findUnique.mockResolvedValueOnce(existingSession({ psychologistId: 'someone-else' }));

        await expect(rescheduleSessionAtomic(PSYCHOLOGIST_ID, SESSION_ID, new Date('2026-09-01'), '11:00'))
            .rejects.toThrow('Сессия не найдена');
        expect(update).not.toHaveBeenCalled();
    });

    it('refuses to reschedule an already-cancelled session', async () => {
        findUnique.mockResolvedValueOnce(existingSession({ status: 'cancelled' }));

        await expect(rescheduleSessionAtomic(PSYCHOLOGIST_ID, SESSION_ID, new Date('2026-09-01'), '11:00'))
            .rejects.toThrow('уже отменена');
        expect(update).not.toHaveBeenCalled();
    });
});
