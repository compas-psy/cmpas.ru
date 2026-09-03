// Task 9 (PRAKTIKA MVP): processPostSessionNudge (src/lib/cron/post-session.ts,
// the mood-check "Как вы себя чувствуете?" message) must stay quiet for a
// session imported from an external calendar — the client never went
// through our booking flow and would find a bot asking about a session it
// "already knows about" confusing.

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
        client: { id: 'client_1', name: 'Клиент', telegramChatId: 'tg_client', maxChatId: null, telegramClient: null },
        psychologist: { id: 'psy_1', notificationSettings: { clientMoodCheckEnabled: true } },
        ...overrides,
    };
}

describe('processPostSessionNudge: quiet on imported sessions (Task 9)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        diarySessionUpdate.mockResolvedValue({});
    });

    it('an imported session gets no mood-check message, but is still marked nudged', async () => {
        diarySessionFindMany.mockResolvedValue([baseSession({ origin: 'import' })]);

        const { processPostSessionNudge } = await import('../src/lib/cron/post-session');
        await processPostSessionNudge();

        expect(sendTelegramMessage).not.toHaveBeenCalled();
        expect(diarySessionUpdate).toHaveBeenCalledWith({ where: { id: 'session_1' }, data: { postSessionNudged: true } });
    });

    it('a non-imported session with mood-check enabled still gets the message as before', async () => {
        diarySessionFindMany.mockResolvedValue([baseSession({ origin: 'self_booking' })]);

        const { processPostSessionNudge } = await import('../src/lib/cron/post-session');
        await processPostSessionNudge();

        expect(sendTelegramMessage).toHaveBeenCalledWith('tg_client', expect.stringContaining('Как вы себя чувствуете'), expect.anything());
    });
});
