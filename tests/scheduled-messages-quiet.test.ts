// Task 9 (PRAKTIKA MVP, founder review 2026-09-03): a pending
// ScheduledClientMessage tied to a specific session (sessionId set) must
// respect that session's clientNotificationsEnabled — this is client-facing
// delivery, same policy as the cron reminders/nudges. It must not stay
// pending forever (the cron would keep re-fetching it every 5 minutes), so
// it moves to a terminal 'failed' state with a distinguishing errorMsg
// instead. manual_pending is unaffected — it only pings the PSYCHOLOGIST to
// send by hand, not the client.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const scheduledClientMessageFindMany = vi.fn();
const scheduledClientMessageUpdate = vi.fn().mockResolvedValue({});
const diarySessionFindUnique = vi.fn();
const diaryClientFindUnique = vi.fn();
const userFindUnique = vi.fn();

vi.mock('@/lib/db', () => ({
    db: {
        scheduledClientMessage: {
            findMany: (...args: unknown[]) => scheduledClientMessageFindMany(...args),
            update: (...args: unknown[]) => scheduledClientMessageUpdate(...args),
        },
        diarySession: {
            findUnique: (...args: unknown[]) => diarySessionFindUnique(...args),
        },
        diaryClient: {
            findUnique: (...args: unknown[]) => diaryClientFindUnique(...args),
        },
        user: {
            findUnique: (...args: unknown[]) => userFindUnique(...args),
        },
    },
}));

const sendTelegramMessage = vi.fn();
vi.mock('@/lib/telegram', () => ({
    sendTelegramMessage: (...args: unknown[]) => sendTelegramMessage(...args),
}));
const sendMaxFull = vi.fn();
vi.mock('@/lib/max-bot', () => ({
    sendMaxMessage: (...args: unknown[]) => sendMaxFull(...args),
}));

function baseMessage(overrides: Record<string, unknown> = {}) {
    return {
        id: 'msg_1',
        psychologistId: 'psy_1',
        clientId: 'client_1',
        sessionId: 'session_1',
        channel: 'telegram',
        text: 'Не забудьте про домашнее задание',
        status: 'pending',
        ...overrides,
    };
}

describe('processScheduledMessages: session-based pending message respects clientNotificationsEnabled (Task 9)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        scheduledClientMessageUpdate.mockResolvedValue({});
        diaryClientFindUnique.mockResolvedValue({ telegramChatId: 'tg_client', maxChatId: null, name: 'Клиент' });
        sendTelegramMessage.mockResolvedValue(true);
    });

    it('sessionId set, clientNotificationsEnabled=false: client send is NOT called, message moves to a terminal state', async () => {
        scheduledClientMessageFindMany.mockResolvedValue([baseMessage()]);
        diarySessionFindUnique.mockResolvedValue({ clientNotificationsEnabled: false });

        const { processScheduledMessages } = await import('../src/lib/cron/scheduled-messages');
        await processScheduledMessages();

        expect(sendTelegramMessage).not.toHaveBeenCalled();
        expect(scheduledClientMessageUpdate).toHaveBeenCalledWith({
            where: { id: 'msg_1' },
            data: { status: 'failed', errorMsg: 'CLIENT_NOTIFICATIONS_DISABLED' },
        });
    });

    it('sessionId set, clientNotificationsEnabled=true: sends as before', async () => {
        scheduledClientMessageFindMany.mockResolvedValue([baseMessage()]);
        diarySessionFindUnique.mockResolvedValue({ clientNotificationsEnabled: true });

        const { processScheduledMessages } = await import('../src/lib/cron/scheduled-messages');
        await processScheduledMessages();

        expect(sendTelegramMessage).toHaveBeenCalledWith('tg_client', baseMessage().text);
        expect(scheduledClientMessageUpdate).toHaveBeenCalledWith({
            where: { id: 'msg_1' },
            data: { status: 'sent', sentAt: expect.any(Date), errorMsg: null },
        });
    });

    it('no sessionId at all: unaffected by the check (not tied to a specific session)', async () => {
        scheduledClientMessageFindMany.mockResolvedValue([baseMessage({ sessionId: null })]);

        const { processScheduledMessages } = await import('../src/lib/cron/scheduled-messages');
        await processScheduledMessages();

        expect(diarySessionFindUnique).not.toHaveBeenCalled();
        expect(sendTelegramMessage).toHaveBeenCalled();
    });

    it("manual_pending (psychologist ping, not client delivery) is unaffected by clientNotificationsEnabled", async () => {
        scheduledClientMessageFindMany.mockResolvedValue([baseMessage({ status: 'manual_pending' })]);
        userFindUnique.mockResolvedValue({ telegramChatId: 'tg_psy', maxChatId: null, fcmToken: null });
        diaryClientFindUnique.mockResolvedValue({ name: 'Клиент', phone: '+79990000000' });

        const { processScheduledMessages } = await import('../src/lib/cron/scheduled-messages');
        await processScheduledMessages();

        // Never even looks at the session's notification policy — this ping targets the psychologist.
        expect(diarySessionFindUnique).not.toHaveBeenCalled();
        expect(sendTelegramMessage).toHaveBeenCalledWith('tg_psy', expect.any(String));
    });
});
