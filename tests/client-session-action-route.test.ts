// Task 3 (PRAKTIKA MVP, item D — founder review of 229d99e): GET
// /api/client/session-action was the confirm/cancel/reschedule link a
// client taps from a reminder message. Before this fix, the token embedded
// in that link was clientActionToken(psychologistId, clientId) — static per
// client, reused across EVERY session and EVERY action, never expiring. A
// token minted for session A's "confirm" button worked to cancel session B,
// or to confirm/cancel/reschedule any other session of that same client,
// forever. This test exercises the REAL src/lib/client-workflow (not
// mocked) end-to-end through the route, proving the new
// sessionActionToken binds and checks psychologistId + clientId +
// sessionId + action + expiresAt.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const db = vi.hoisted(() => ({
    diarySession: {
        findUnique: vi.fn(),
        update: vi.fn().mockResolvedValue({}),
    },
    psychologistSettings: {
        findUnique: vi.fn().mockResolvedValue({ cancellationHours: 0, privateRemindersEnabled: false }),
    },
}));
vi.mock('@/lib/db', () => ({ db }));

vi.mock('@/lib/calendar/auto-sync', () => ({
    autoDeleteSessionFromCalendars: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@/lib/notifications', () => ({
    createNotification: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@/lib/client-cancellation', () => ({
    canClientCancel: () => ({ allowed: true }),
    clientCancelBlockedMessage: () => 'Отмена недоступна',
    isClientLinkExpired: () => false,
}));
vi.mock('@/lib/waitlist-notify', () => ({
    notifyWaitlistOnFreedSlot: vi.fn().mockResolvedValue(undefined),
}));

function makeSession(overrides: Record<string, unknown> = {}) {
    return {
        id: 'session-A',
        psychologistId: 'psy-1',
        clientId: 'client-1',
        date: new Date(Date.now() + 24 * 60 * 60 * 1000), // future — token not expired by session date
        time: '10:00',
        status: 'pending',
        client: { name: 'Клиент' },
        ...overrides,
    };
}

async function req(qs: Record<string, string>) {
    const { NextRequest } = await import('next/server');
    const params = new URLSearchParams(qs);
    return new NextRequest(`https://cmpas.ru/api/client/session-action?${params.toString()}`);
}

describe('GET /api/client/session-action — session/action-scoped tokens (Task 3, item D)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.resetModules();
        db.diarySession.findUnique.mockResolvedValue(makeSession());
        db.psychologistSettings.findUnique.mockResolvedValue({ cancellationHours: 0, privateRemindersEnabled: false });
    });

    it('валидный confirm-токен подтверждает свою сессию', async () => {
        const { sessionActionToken, sessionActionTokenExpiry } = await import('../src/lib/client-workflow');
        const session = makeSession();
        const token = sessionActionToken(session.psychologistId, session.clientId, session.id, 'confirm', sessionActionTokenExpiry(session.date));

        const { GET } = await import('../src/app/api/client/session-action/route');
        const res = await GET(await req({ s: session.id, a: 'confirm', t: token }));

        expect(res.status).toBe(200);
        expect(db.diarySession.update).toHaveBeenCalledWith({ where: { id: session.id }, data: { status: 'confirmed' } });
    });

    it('тот же confirm-токен НЕ работает как cancel-токен на той же сессии', async () => {
        const { sessionActionToken, sessionActionTokenExpiry } = await import('../src/lib/client-workflow');
        const session = makeSession();
        const confirmToken = sessionActionToken(session.psychologistId, session.clientId, session.id, 'confirm', sessionActionTokenExpiry(session.date));

        const { GET } = await import('../src/app/api/client/session-action/route');
        const res = await GET(await req({ s: session.id, a: 'cancel', t: confirmToken }));
        const text = await res.text();

        expect(text).toContain('Ссылка недействительна');
        expect(db.diarySession.update).not.toHaveBeenCalled();
    });

    it('cancel-токен сессии A НЕ работает на сессии B того же клиента', async () => {
        const { sessionActionToken, sessionActionTokenExpiry } = await import('../src/lib/client-workflow');
        const sessionA = makeSession({ id: 'session-A' });
        const sessionB = makeSession({ id: 'session-B' });
        const tokenForA = sessionActionToken(sessionA.psychologistId, sessionA.clientId, sessionA.id, 'cancel', sessionActionTokenExpiry(sessionA.date));

        db.diarySession.findUnique.mockResolvedValue(sessionB);

        const { GET } = await import('../src/app/api/client/session-action/route');
        const res = await GET(await req({ s: sessionB.id, a: 'cancel', t: tokenForA }));
        const text = await res.text();

        expect(text).toContain('Ссылка недействительна');
        expect(db.diarySession.update).not.toHaveBeenCalled();
    });

    it('просроченный токен отклоняется', async () => {
        const { sessionActionToken } = await import('../src/lib/client-workflow');
        const session = makeSession();
        const expiredAt = Date.now() - 1000;
        const token = sessionActionToken(session.psychologistId, session.clientId, session.id, 'confirm', expiredAt);

        const { GET } = await import('../src/app/api/client/session-action/route');
        const res = await GET(await req({ s: session.id, a: 'confirm', t: token }));
        const text = await res.text();

        expect(text).toContain('Ссылка недействительна');
        expect(db.diarySession.update).not.toHaveBeenCalled();
    });

    it('старый формат токена (до фикса — голый хэш psy:client) отклоняется, ссылка становится недействительной', async () => {
        const { createHash } = await import('crypto');
        const session = makeSession();
        const oldStyleToken = createHash('sha256').update(`${session.psychologistId}:${session.clientId}:whatever-secret-guess`).digest('hex');

        const { GET } = await import('../src/app/api/client/session-action/route');
        const res = await GET(await req({ s: session.id, a: 'cancel', t: oldStyleToken }));
        const text = await res.text();

        expect(text).toContain('Ссылка недействительна');
        expect(db.diarySession.update).not.toHaveBeenCalled();
    });

    it('неизвестное значение a= (не confirm/cancel/reschedule) отклоняется до похода в БД', async () => {
        const { GET } = await import('../src/app/api/client/session-action/route');
        const res = await GET(await req({ s: 'session-A', a: 'delete-everything', t: 'anything' }));
        const text = await res.text();

        expect(text).toContain('Ссылка недействительна');
        expect(db.diarySession.findUnique).not.toHaveBeenCalled();
    });
});
