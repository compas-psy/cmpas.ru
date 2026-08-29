// O-260829 §5.4: вечерняя отметка специалиста — markSessionOutcome.
// Проверяем: (1) 'completed' проставляет outcomeMarkedAt; (2) чужую сессию
// отметить нельзя (ownership-проверка, тот же приём, что rescheduleSessionAtomic);
// (3) повторная отметка (передумал) разрешена и перезаписывает исход.

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
vi.mock('@/lib/session-reschedule', () => ({
    rescheduleSessionAtomic: vi.fn(),
}));

function baseSession(overrides: Record<string, unknown> = {}) {
    return {
        id: 'session_1',
        psychologistId: 'psy_1',
        clientId: 'client_1',
        outcome: null,
        outcomeMarkedAt: null,
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

    it("'completed' проставляет outcome и outcomeMarkedAt", async () => {
        auth.mockResolvedValue({ user: { id: 'psy_1' } });
        diarySessionFindUnique.mockResolvedValue(baseSession());
        diarySessionUpdate.mockImplementation(({ data }: any) => ({ ...baseSession(), ...data }));

        const { markSessionOutcome } = await import('../src/app/diary/actions/sessions');
        const result = await markSessionOutcome('session_1', 'completed');

        expect(diarySessionUpdate).toHaveBeenCalledWith({
            where: { id: 'session_1' },
            data: { outcome: 'completed', outcomeMarkedAt: expect.any(Date) },
        });
        expect(result.outcome).toBe('completed');
        expect(result.outcomeMarkedAt).toBeInstanceOf(Date);
        expect(revalidatePath).toHaveBeenCalledWith('/diary');
    });

    it("'no_show' тоже проставляет outcomeMarkedAt", async () => {
        auth.mockResolvedValue({ user: { id: 'psy_1' } });
        diarySessionFindUnique.mockResolvedValue(baseSession());
        diarySessionUpdate.mockImplementation(({ data }: any) => ({ ...baseSession(), ...data }));

        const { markSessionOutcome } = await import('../src/app/diary/actions/sessions');
        const result = await markSessionOutcome('session_1', 'no_show');

        expect(result.outcome).toBe('no_show');
        expect(result.outcomeMarkedAt).toBeInstanceOf(Date);
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

    it('повторная отметка (специалист передумал) разрешена и перезаписывает исход', async () => {
        auth.mockResolvedValue({ user: { id: 'psy_1' } });
        diarySessionFindUnique.mockResolvedValue(baseSession({ outcome: 'completed', outcomeMarkedAt: new Date('2026-01-01') }));
        diarySessionUpdate.mockImplementation(({ data }: any) => ({ ...baseSession(), ...data }));

        const { markSessionOutcome } = await import('../src/app/diary/actions/sessions');
        const result = await markSessionOutcome('session_1', 'no_show');

        expect(result.outcome).toBe('no_show');
        expect(diarySessionUpdate).toHaveBeenCalledTimes(1);
    });

    it('без сессии авторизации — Unauthorized, update не вызывается', async () => {
        auth.mockResolvedValue(null);

        const { markSessionOutcome } = await import('../src/app/diary/actions/sessions');
        await expect(markSessionOutcome('session_1', 'completed')).rejects.toThrow('Unauthorized');
        expect(diarySessionUpdate).not.toHaveBeenCalled();
    });
});
