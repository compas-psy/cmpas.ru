// Task 3 (PRAKTIKA MVP, item D): src/app/client/reschedule/[sessionId]/actions.ts
// authorizes every reschedule server action via the same session-scoped
// token. Verifies end-to-end with the REAL src/lib/client-workflow.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const db = vi.hoisted(() => ({
    diarySession: { findUnique: vi.fn() },
}));
vi.mock('@/lib/db', () => ({ db }));

vi.mock('@/app/bot/actions', () => ({
    getAvailableDates: vi.fn(),
    getAvailableTimes: vi.fn(),
}));
vi.mock('@/lib/session-reschedule', () => ({
    rescheduleSessionAtomic: vi.fn(),
    RescheduleConflictError: class RescheduleConflictError extends Error {},
}));
vi.mock('@/lib/notifications', () => ({ createNotification: vi.fn().mockResolvedValue(undefined) }));

function makeSession(overrides: Record<string, unknown> = {}) {
    return {
        id: 'session-A',
        psychologistId: 'psy-1',
        clientId: 'client-1',
        date: new Date(Date.now() + 24 * 60 * 60 * 1000),
        time: '10:00',
        status: 'confirmed',
        client: { name: 'Клиент' },
        psychologist: { name: 'Анна' },
        ...overrides,
    };
}

describe('client/reschedule actions — session-scoped token (Task 3, item D)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.resetModules();
    });

    it('валидный reschedule-токен своей сессии — читает данные сессии', async () => {
        const { sessionActionToken, sessionActionTokenExpiry } = await import('../src/lib/client-workflow');
        const session = makeSession();
        db.diarySession.findUnique.mockResolvedValue(session);
        const token = sessionActionToken(session.psychologistId, session.clientId, session.id, 'reschedule', sessionActionTokenExpiry(session.date));

        const { getClientRescheduleSession } = await import('../src/app/client/reschedule/[sessionId]/actions');
        const result = await getClientRescheduleSession(session.id, token);

        expect(result.clientName).toBe('Клиент');
    });

    it('cancel-токен той же сессии не авторизует reschedule', async () => {
        const { sessionActionToken, sessionActionTokenExpiry } = await import('../src/lib/client-workflow');
        const session = makeSession();
        db.diarySession.findUnique.mockResolvedValue(session);
        const cancelToken = sessionActionToken(session.psychologistId, session.clientId, session.id, 'cancel', sessionActionTokenExpiry(session.date));

        const { getClientRescheduleSession } = await import('../src/app/client/reschedule/[sessionId]/actions');
        await expect(getClientRescheduleSession(session.id, cancelToken)).rejects.toThrow('Ссылка недействительна');
    });

    it('reschedule-токен ДРУГОЙ сессии того же клиента отклоняется', async () => {
        const { sessionActionToken, sessionActionTokenExpiry } = await import('../src/lib/client-workflow');
        const otherSession = makeSession({ id: 'session-OTHER' });
        const targetSession = makeSession({ id: 'session-A' });
        const tokenForOther = sessionActionToken(otherSession.psychologistId, otherSession.clientId, otherSession.id, 'reschedule', sessionActionTokenExpiry(otherSession.date));

        db.diarySession.findUnique.mockResolvedValue(targetSession);

        const { getClientRescheduleSession } = await import('../src/app/client/reschedule/[sessionId]/actions');
        await expect(getClientRescheduleSession(targetSession.id, tokenForOther)).rejects.toThrow('Ссылка недействительна');
    });
});
