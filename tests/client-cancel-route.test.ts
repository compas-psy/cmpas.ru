// Task 3 (PRAKTIKA MVP, item D): POST /api/user/diary/bot/client/cancel is
// the "Мои записи" page's cancel action (CancelSessionDialog). Its token now
// must be bound to the specific session and to the 'cancel' action —
// verifies end-to-end with the REAL src/lib/client-workflow.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const db = vi.hoisted(() => ({
    diarySession: {
        findUnique: vi.fn(),
        update: vi.fn(),
    },
    psychologistSettings: {
        findUnique: vi.fn().mockResolvedValue({ cancellationHours: 0 }),
    },
}));
vi.mock('@/lib/db', () => ({ db }));

vi.mock('@/lib/telegram', () => ({ sendTelegramMessage: vi.fn() }));
vi.mock('@/lib/client-cancellation', () => ({
    canClientCancel: () => ({ allowed: true }),
    clientCancelBlockedMessage: () => 'Отмена недоступна',
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
        psychologist: { telegramChatId: null },
        client: { name: 'Клиент' },
        ...overrides,
    };
}

function post(body: unknown) {
    return new Request('https://cmpas.ru/api/user/diary/bot/client/cancel', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
    });
}

describe('POST /api/user/diary/bot/client/cancel — session-scoped token (Task 3, item D)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.resetModules();
        db.psychologistSettings.findUnique.mockResolvedValue({ cancellationHours: 0 });
    });

    it('валидный cancel-токен для своей сессии — отменяет', async () => {
        const { sessionActionToken, sessionActionTokenExpiry } = await import('../src/lib/client-workflow');
        const session = makeSession();
        db.diarySession.findUnique.mockResolvedValue(session);
        db.diarySession.update.mockResolvedValue({ ...session, status: 'cancelled' });
        const token = sessionActionToken(session.psychologistId, session.clientId, session.id, 'cancel', sessionActionTokenExpiry(session.date));

        const { POST } = await import('../src/app/api/user/diary/bot/client/cancel/route');
        const res = await POST(post({ sessionId: session.id, clientId: session.clientId, clientToken: token }) as any);

        expect(res.status).toBe(200);
        expect(db.diarySession.update).toHaveBeenCalled();
    });

    it('cancel-токен, выпущенный для ДРУГОЙ сессии того же клиента, отклоняется', async () => {
        const { sessionActionToken, sessionActionTokenExpiry } = await import('../src/lib/client-workflow');
        const otherSession = makeSession({ id: 'session-OTHER' });
        const targetSession = makeSession({ id: 'session-A' });
        const tokenForOther = sessionActionToken(otherSession.psychologistId, otherSession.clientId, otherSession.id, 'cancel', sessionActionTokenExpiry(otherSession.date));

        db.diarySession.findUnique.mockResolvedValue(targetSession);

        const { POST } = await import('../src/app/api/user/diary/bot/client/cancel/route');
        const res = await POST(post({ sessionId: targetSession.id, clientId: targetSession.clientId, clientToken: tokenForOther }) as any);

        expect(res.status).toBe(403);
        expect(db.diarySession.update).not.toHaveBeenCalled();
    });

    it('токен из /api/client/session-action с a=confirm не работает здесь (это cancel-эндпоинт)', async () => {
        const { sessionActionToken, sessionActionTokenExpiry } = await import('../src/lib/client-workflow');
        const session = makeSession();
        db.diarySession.findUnique.mockResolvedValue(session);
        const confirmToken = sessionActionToken(session.psychologistId, session.clientId, session.id, 'confirm', sessionActionTokenExpiry(session.date));

        const { POST } = await import('../src/app/api/user/diary/bot/client/cancel/route');
        const res = await POST(post({ sessionId: session.id, clientId: session.clientId, clientToken: confirmToken }) as any);

        expect(res.status).toBe(403);
        expect(db.diarySession.update).not.toHaveBeenCalled();
    });
});
