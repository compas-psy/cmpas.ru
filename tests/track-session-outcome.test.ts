// O-260829 §7: markSessionOutcome должна писать событие session_outcome_marked
// (analytics/schema/events.yaml) с исходом и часами после конца сессии, а не
// молча менять только DiarySession.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const auth = vi.fn();
vi.mock('@/auth', () => ({ auth: (...args: unknown[]) => auth(...args) }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

const diarySessionFindUnique = vi.fn();
const diarySessionUpdate = vi.fn();
vi.mock('@/lib/db', () => ({
    db: {
        diarySession: {
            findUnique: (...args: unknown[]) => diarySessionFindUnique(...args),
            update: (...args: unknown[]) => diarySessionUpdate(...args),
        },
    },
}));

vi.mock('@/lib/calendar/auto-sync', () => ({
    autoSyncSessionToCalendars: vi.fn(),
    autoDeleteSessionFromCalendars: vi.fn(),
}));
vi.mock('@/lib/telegram', () => ({ sendTelegramMessage: vi.fn() }));
vi.mock('@/lib/max-bot', () => ({ sendMaxMessage: vi.fn() }));
vi.mock('@/lib/client-workflow', () => ({
    buildSessionClientMessage: vi.fn(),
    clientBookingLink: vi.fn(),
    createAutoDocumentDeliveries: vi.fn(),
    getPaymentInstruction: vi.fn(),
}));
vi.mock('@/lib/session-reschedule', () => ({ rescheduleSessionAtomic: vi.fn() }));

const track = vi.fn().mockResolvedValue(undefined);
vi.mock('@/lib/analytics/track', () => ({ track: (...args: unknown[]) => track(...args) }));

function baseSession(overrides: Record<string, unknown> = {}) {
    return {
        id: 'session_1',
        psychologistId: 'psy_1',
        clientId: 'client_1',
        date: new Date('2026-09-10T00:00:00Z'),
        time: '10:00',
        endTime: '10:50',
        status: 'confirmed',
        ...overrides,
    };
}

describe('markSessionOutcome пишет session_outcome_marked (O-260829 §7)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        auth.mockResolvedValue({ user: { id: 'psy_1' } });
        diarySessionUpdate.mockResolvedValue(baseSession({ status: 'completed' }));
    });

    it('completed — событие несёт outcome и положительное hours_after_end', async () => {
        diarySessionFindUnique.mockResolvedValue(baseSession());
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-09-10T13:00:00Z')); // ровно 2ч после конца сессии (10:50)

        try {
            const { markSessionOutcome } = await import('../src/app/diary/actions/sessions');
            await markSessionOutcome('session_1', 'completed');
        } finally {
            vi.useRealTimers();
        }

        expect(track).toHaveBeenCalledTimes(1);
        expect(track.mock.calls[0][1]).toMatchObject({
            event: 'session_outcome_marked',
            product: 'practice',
            accountId: 'psy_1',
            props: { outcome: 'completed', hours_after_end: 2 },
        });
    });

    it('no_show — outcome в событии соответствует переданному значению', async () => {
        diarySessionFindUnique.mockResolvedValue(baseSession());

        const { markSessionOutcome } = await import('../src/app/diary/actions/sessions');
        await markSessionOutcome('session_1', 'no_show');

        expect(track.mock.calls[0][1]).toMatchObject({ props: { outcome: 'no_show' } });
    });

    it('чужая сессия — track() не вызывается вовсе', async () => {
        diarySessionFindUnique.mockResolvedValue(baseSession({ psychologistId: 'someone-else' }));

        const { markSessionOutcome } = await import('../src/app/diary/actions/sessions');
        await expect(markSessionOutcome('session_1', 'completed')).rejects.toThrow();

        expect(track).not.toHaveBeenCalled();
    });
});
