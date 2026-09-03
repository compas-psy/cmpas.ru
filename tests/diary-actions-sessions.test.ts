// O-260829 §5.4 (правка по дополняющему Android-ТЗ, android_booking_v2.md
// §1): вечерняя отметка специалиста — markSessionOutcome — пишет ПРЯМО в
// DiarySession.status ('completed' | 'no_show'), а не в отдельное поле
// outcome. Проверяем: (1) 'completed'/'no_show' проставляют status;
// (2) чужую сессию отметить нельзя; (3) повторная отметка (передумал)
// разрешена и перезаписывает status; (4) отменённую сессию отметить нельзя.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const auth = vi.fn();
vi.mock('@/auth', () => ({ auth: (...args: unknown[]) => auth(...args) }));

const revalidatePath = vi.fn();
vi.mock('next/cache', () => ({ revalidatePath: (...args: unknown[]) => revalidatePath(...args) }));

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

// Эти зависимости самого файла sessions.ts тянут calendar-sync/telegram/max —
// не нужны markSessionOutcome, но модуль их импортирует на верхнем уровне.
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
vi.mock('@/lib/waitlist-notify', () => ({ notifyWaitlistOnFreedSlot: vi.fn() }));
vi.mock('@/lib/practice/booking/booking', () => ({
    createManualPracticeSession: vi.fn(),
    reschedulePracticeBooking: vi.fn(),
    BookingConflictError: class BookingConflictError extends Error {},
}));
// O-260829 §7: track() — реальный модуль не нужен этим тестам markSessionOutcome
// (о самой отправке события пишет tests/track-session-outcome.test.ts).
vi.mock('@/lib/analytics/track', () => ({ track: vi.fn() }));

function baseSession(overrides: Record<string, unknown> = {}) {
    return {
        id: 'session_1',
        psychologistId: 'psy_1',
        clientId: 'client_1',
        date: new Date(Date.now() - 3 * 60 * 60 * 1000),
        time: '10:00',
        endTime: '10:50',
        status: 'confirmed',
        ...overrides,
    };
}

describe('markSessionOutcome (§5.4 вечерняя отметка специалиста)', () => {
    beforeEach(() => {
        vi.resetModules();
        auth.mockReset();
        revalidatePath.mockReset();
        diarySessionFindUnique.mockReset();
        diarySessionUpdate.mockReset();
    });

    it("'completed' проставляет status='completed'", async () => {
        auth.mockResolvedValue({ user: { id: 'psy_1' } });
        diarySessionFindUnique.mockResolvedValue(baseSession());
        diarySessionUpdate.mockImplementation(({ data }: any) => ({ ...baseSession(), ...data }));

        const { markSessionOutcome } = await import('../src/app/diary/actions/sessions');
        const result = await markSessionOutcome('session_1', 'completed');

        expect(diarySessionUpdate).toHaveBeenCalledWith({
            where: { id: 'session_1' },
            data: { status: 'completed' },
        });
        expect(result.status).toBe('completed');
        expect(revalidatePath).toHaveBeenCalledWith('/diary');
    });

    it("'no_show' проставляет status='no_show'", async () => {
        auth.mockResolvedValue({ user: { id: 'psy_1' } });
        diarySessionFindUnique.mockResolvedValue(baseSession());
        diarySessionUpdate.mockImplementation(({ data }: any) => ({ ...baseSession(), ...data }));

        const { markSessionOutcome } = await import('../src/app/diary/actions/sessions');
        const result = await markSessionOutcome('session_1', 'no_show');

        expect(result.status).toBe('no_show');
    });

    it("можно отметить сессию, уже автоматически переведённую в 'completed' settlePastSessionsForPsychologist, на 'no_show' задним числом", async () => {
        auth.mockResolvedValue({ user: { id: 'psy_1' } });
        diarySessionFindUnique.mockResolvedValue(baseSession({ status: 'completed' }));
        diarySessionUpdate.mockImplementation(({ data }: any) => ({ ...baseSession(), ...data }));

        const { markSessionOutcome } = await import('../src/app/diary/actions/sessions');
        const result = await markSessionOutcome('session_1', 'no_show');

        expect(result.status).toBe('no_show');
    });

    it('чужую сессию отметить нельзя — бросает ошибку, update не вызывается', async () => {
        auth.mockResolvedValue({ user: { id: 'psy_other' } });
        diarySessionFindUnique.mockResolvedValue(baseSession({ psychologistId: 'psy_1' }));

        const { markSessionOutcome } = await import('../src/app/diary/actions/sessions');
        await expect(markSessionOutcome('session_1', 'completed')).rejects.toThrow('Сессия не найдена');

        expect(diarySessionUpdate).not.toHaveBeenCalled();
    });

    it('несуществующая сессия — та же ошибка', async () => {
        auth.mockResolvedValue({ user: { id: 'psy_1' } });
        diarySessionFindUnique.mockResolvedValue(null);

        const { markSessionOutcome } = await import('../src/app/diary/actions/sessions');
        await expect(markSessionOutcome('missing', 'no_show')).rejects.toThrow('Сессия не найдена');
        expect(diarySessionUpdate).not.toHaveBeenCalled();
    });

    it('отменённую сессию отметить нельзя — бросает ошибку, update не вызывается', async () => {
        auth.mockResolvedValue({ user: { id: 'psy_1' } });
        diarySessionFindUnique.mockResolvedValue(baseSession({ status: 'cancelled' }));

        const { markSessionOutcome } = await import('../src/app/diary/actions/sessions');
        await expect(markSessionOutcome('session_1', 'completed')).rejects.toThrow('отменена');
        expect(diarySessionUpdate).not.toHaveBeenCalled();
    });

    it('повторная отметка (специалист передумал) разрешена и перезаписывает status', async () => {
        auth.mockResolvedValue({ user: { id: 'psy_1' } });
        diarySessionFindUnique.mockResolvedValue(baseSession({ status: 'completed' }));
        diarySessionUpdate.mockImplementation(({ data }: any) => ({ ...baseSession(), ...data }));

        const { markSessionOutcome } = await import('../src/app/diary/actions/sessions');
        const result = await markSessionOutcome('session_1', 'no_show');

        expect(result.status).toBe('no_show');
        expect(diarySessionUpdate).toHaveBeenCalledTimes(1);
    });

    it('без сессии авторизации — Unauthorized, update не вызывается', async () => {
        auth.mockResolvedValue(null);

        const { markSessionOutcome } = await import('../src/app/diary/actions/sessions');
        await expect(markSessionOutcome('session_1', 'completed')).rejects.toThrow('Unauthorized');
        expect(diarySessionUpdate).not.toHaveBeenCalled();
    });
});
