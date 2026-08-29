// O-260829 §7: processNextBookingNudge/processWeeklyFollowup должны писать
// rebooking_nudge_sent/weekly_followup_sent (analytics/schema/events.yaml)
// exactly when a message was actually sent to a known client — not when
// there was no channel to reach them.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const diarySessionFindMany = vi.fn();
const diarySessionFindFirst = vi.fn();
const diarySessionUpdate = vi.fn().mockResolvedValue({});
const userFindUnique = vi.fn();

vi.mock('@/lib/db', () => ({
    db: {
        diarySession: {
            findMany: (...args: unknown[]) => diarySessionFindMany(...args),
            findFirst: (...args: unknown[]) => diarySessionFindFirst(...args),
            update: (...args: unknown[]) => diarySessionUpdate(...args),
        },
        user: { findUnique: (...args: unknown[]) => userFindUnique(...args) },
    },
}));

const sendTelegramMessage = vi.fn().mockResolvedValue(true);
vi.mock('@/lib/telegram', () => ({ sendTelegramMessage: (...args: unknown[]) => sendTelegramMessage(...args) }));
vi.mock('@/lib/max', () => ({ sendMaxMessage: vi.fn() }));
vi.mock('@/lib/client-workflow', () => ({
    clientBookingLink: (psychologistId: string, clientId: string) => `https://cmpas.ru/bot/book/${psychologistId}?c=token-${clientId}`,
}));
vi.mock('@/lib/booking/slug', () => ({ getPsychologistBookingUrl: vi.fn().mockResolvedValue('https://cmpas.ru/u/anna') }));
vi.mock('@/app/bot/actions', () => ({ getSuggestedTimes: vi.fn().mockResolvedValue([]) }));

const track = vi.fn().mockResolvedValue(undefined);
vi.mock('@/lib/analytics/track', () => ({ track: (...args: unknown[]) => track(...args) }));

function baseSession(overrides: Record<string, unknown> = {}) {
    return {
        id: 'session_1',
        psychologistId: 'psy_1',
        clientId: 'client_1',
        date: new Date(),
        time: '13:00',
        endTime: '13:50',
        status: 'confirmed',
        outcome: null,
        nextBookingNudgeSent: false,
        weeklyFollowupSent: false,
        client: { id: 'client_1', name: 'Клиент', telegramClient: null, telegramChatId: 'tg_client', maxChatId: null },
        ...overrides,
    };
}

function endTimeStrFor(d: Date): string {
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

beforeEach(() => {
    vi.clearAllMocks();
    userFindUnique.mockResolvedValue({ name: 'Анна Волкова', psychologistSettings: null });
    sendTelegramMessage.mockResolvedValue(true);
});

describe('processNextBookingNudge пишет rebooking_nudge_sent (O-260829 §7)', () => {
    it('клиент с каналом получил сообщение — событие уходит с accountId специалиста', async () => {
        const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000);
        diarySessionFindMany.mockResolvedValue([
            baseSession({ date: threeHoursAgo, time: '00:00', endTime: endTimeStrFor(threeHoursAgo) }),
        ]);

        const { processNextBookingNudge } = await import('../src/lib/cron/post-session-cascade');
        await processNextBookingNudge();

        expect(track).toHaveBeenCalledTimes(1);
        expect(track.mock.calls[0][1]).toMatchObject({
            event: 'rebooking_nudge_sent',
            product: 'practice',
            accountId: 'psy_1',
        });
    });

    it('сессия без клиента — событие не пишется', async () => {
        const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000);
        diarySessionFindMany.mockResolvedValue([
            baseSession({ date: threeHoursAgo, time: '00:00', endTime: endTimeStrFor(threeHoursAgo), client: null }),
        ]);

        const { processNextBookingNudge } = await import('../src/lib/cron/post-session-cascade');
        await processNextBookingNudge();

        expect(track).not.toHaveBeenCalled();
    });
});

describe('processWeeklyFollowup пишет weekly_followup_sent (O-260829 §7)', () => {
    it('сообщение реально ушло (нет будущей записи) — событие пишется', async () => {
        const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
        diarySessionFindMany.mockResolvedValue([
            baseSession({ date: eightDaysAgo, time: '00:00', endTime: endTimeStrFor(eightDaysAgo), outcome: 'completed' }),
        ]);
        diarySessionFindFirst.mockResolvedValue(null);

        const { processWeeklyFollowup } = await import('../src/lib/cron/post-session-cascade');
        await processWeeklyFollowup();

        expect(track).toHaveBeenCalledTimes(1);
        expect(track.mock.calls[0][1]).toMatchObject({
            event: 'weekly_followup_sent',
            product: 'practice',
            accountId: 'psy_1',
        });
    });

    it('у клиента уже есть будущая запись — событие НЕ пишется (сообщение не уходило)', async () => {
        const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
        diarySessionFindMany.mockResolvedValue([
            baseSession({ date: eightDaysAgo, time: '00:00', endTime: endTimeStrFor(eightDaysAgo), outcome: 'completed' }),
        ]);
        diarySessionFindFirst.mockResolvedValue({ id: 'future' });

        const { processWeeklyFollowup } = await import('../src/lib/cron/post-session-cascade');
        await processWeeklyFollowup();

        expect(track).not.toHaveBeenCalled();
    });
});
