// Task 9 (PRAKTIKA MVP, founder review 2026-09-03): processPostSessionNudge
// (src/lib/cron/post-session.ts, the mood-check "Как вы себя чувствуете?"
// message) must stay quiet for a session with clientNotificationsEnabled
// false — gated on that boolean field alone, never on origin. It's a purely
// client-facing job (no psychologist-facing counterpart shares this query),
// so the filter lives in the query's WHERE clause: such a session never
// reaches this job at all, and never gets postSessionNudged set — so
// re-enabling the flag later picks it straight back up.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const diarySessionFindMany = vi.fn();
const diarySessionUpdate = vi.fn().mockResolvedValue({});

vi.mock('@/lib/db', () => ({
    db: {
        diarySession: {
            findMany: (...args: unknown[]) => diarySessionFindMany(...args),
            update: (...args: unknown[]) => diarySessionUpdate(...args),
        },
    },
}));

const sendTelegramMessage = vi.fn();
vi.mock('@/lib/telegram', () => ({
    sendTelegramMessage: (...args: unknown[]) => sendTelegramMessage(...args),
}));
vi.mock('@/lib/max', () => ({ sendMaxMessage: vi.fn() }));
vi.mock('@/lib/max-bot', () => ({ sendMaxMessage: vi.fn() }));

function baseSession(overrides: Record<string, unknown> = {}) {
    const fortyFiveMinAgo = new Date(Date.now() - 45 * 60 * 1000);
    return {
        id: 'session_1',
        status: 'confirmed',
        postSessionNudged: false,
        date: new Date(new Date().setHours(0, 0, 0, 0)),
        time: `${String(fortyFiveMinAgo.getHours()).padStart(2, '0')}:${String(fortyFiveMinAgo.getMinutes()).padStart(2, '0')}`,
        endTime: `${String(fortyFiveMinAgo.getHours()).padStart(2, '0')}:${String(fortyFiveMinAgo.getMinutes()).padStart(2, '0')}`,
        origin: 'self_booking',
        clientNotificationsEnabled: true,
        client: { id: 'client_1', name: 'Клиент', telegramChatId: 'tg_client', maxChatId: null, telegramClient: null },
        psychologist: { id: 'psy_1', notificationSettings: { clientMoodCheckEnabled: true } },
        ...overrides,
    };
}

describe('processPostSessionNudge: quiet on clientNotificationsEnabled=false (Task 9)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        diarySessionUpdate.mockResolvedValue({});
    });

    it('the query filters clientNotificationsEnabled: true — a disabled session never reaches this job', async () => {
        diarySessionFindMany.mockResolvedValue([]);

        const { processPostSessionNudge } = await import('../src/lib/cron/post-session');
        await processPostSessionNudge();

        const where = diarySessionFindMany.mock.calls[0][0].where;
        expect(where.clientNotificationsEnabled).toBe(true);
    });

    it('a session with clientNotificationsEnabled=true (regardless of origin) still gets the mood-check message as before', async () => {
        diarySessionFindMany.mockResolvedValue([baseSession({ origin: 'calendar_import', clientNotificationsEnabled: true })]);

        const { processPostSessionNudge } = await import('../src/lib/cron/post-session');
        await processPostSessionNudge();

        expect(sendTelegramMessage).toHaveBeenCalledWith('tg_client', expect.stringContaining('Как вы себя чувствуете'), expect.anything());
    });
});
