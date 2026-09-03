// O-260829 §5.2: notifyWaitlistOnFreedSlot должна вызываться из ОБОИХ мест,
// где час на самом деле освобождается — перенос (Task 8:
// reschedulePracticeBooking из src/lib/practice/booking/booking.ts,
// вызываемый из src/app/diary/actions/sessions.ts:rescheduleSession) и
// отмена клиентом по подписанной ссылке
// (GET /api/client/session-action?a=cancel). Проверяем именно факт вызова с
// правильным (СТАРЫМ, освободившимся) временем — саму логику подбора заявки
// покрывает tests/waitlist-notify.test.ts.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const notifyWaitlistOnFreedSlot = vi.fn().mockResolvedValue({ notified: false });
vi.mock('@/lib/waitlist-notify', () => ({
    notifyWaitlistOnFreedSlot: (...args: unknown[]) => notifyWaitlistOnFreedSlot(...args),
}));

describe('notifyWaitlistOnFreedSlot вызывается из переноса и отмены (O-260829 §5.2)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.resetModules();
    });

    it('rescheduleSession (Task 8: reschedulePracticeBooking) зовёт notifyWaitlistOnFreedSlot со СТАРЫМ (освободившимся) временем', async () => {
        const auth = vi.fn().mockResolvedValue({ user: { id: 'psy_1' } });
        vi.doMock('@/auth', () => ({ auth: (...args: unknown[]) => auth(...args) }));
        vi.doMock('next/cache', () => ({ revalidatePath: vi.fn() }));

        const oldDate = new Date('2026-09-10T00:00:00Z');
        const newDate = new Date('2026-09-12T00:00:00Z');

        const diarySessionFindUnique = vi.fn().mockResolvedValue({
            id: 'session_1', psychologistId: 'psy_1', date: newDate, time: '15:00', client: { name: 'Клиент' },
        });
        vi.doMock('@/lib/db', () => ({
            db: { diarySession: { findUnique: (...args: unknown[]) => diarySessionFindUnique(...args) } },
        }));
        vi.doMock('@/lib/calendar/auto-sync', () => ({
            autoSyncSessionToCalendars: vi.fn().mockResolvedValue(undefined),
            autoDeleteSessionFromCalendars: vi.fn().mockResolvedValue(undefined),
        }));
        vi.doMock('@/lib/telegram', () => ({ sendTelegramMessage: vi.fn() }));
        vi.doMock('@/lib/max-bot', () => ({ sendMaxMessage: vi.fn() }));
        vi.doMock('@/lib/client-workflow', () => ({
            buildSessionClientMessage: vi.fn(),
            clientBookingLink: vi.fn(),
            createAutoDocumentDeliveries: vi.fn(),
            getPaymentInstruction: vi.fn(),
        }));
        vi.doMock('@/lib/analytics/track', () => ({ track: vi.fn() }));

        const reschedulePracticeBooking = vi.fn().mockResolvedValue({
            session: { id: 'session_1', psychologistId: 'psy_1', date: newDate, time: '15:00' },
            previousDate: oldDate,
            previousTime: '10:00',
        });
        vi.doMock('@/lib/practice/booking/booking', () => ({
            reschedulePracticeBooking,
            createManualPracticeSession: vi.fn(),
            BookingConflictError: class BookingConflictError extends Error {},
        }));

        const { rescheduleSession } = await import('../src/app/diary/actions/sessions');
        await rescheduleSession('session_1', 'slt1_test-token');

        expect(reschedulePracticeBooking).toHaveBeenCalledWith(expect.objectContaining({
            psychologistId: 'psy_1', sessionId: 'session_1', slotToken: 'slt1_test-token',
        }));

        // Fire-and-forget внутри rescheduleSession — дать микрозадачам отработать.
        await new Promise((r) => setImmediate(r));

        expect(notifyWaitlistOnFreedSlot).toHaveBeenCalledWith('psy_1', oldDate, '10:00');
    });

    it('отмена сессии (GET .../session-action?a=cancel) зовёт notifyWaitlistOnFreedSlot с временем отменённой сессии', async () => {
        const sessionDate = new Date('2026-09-10T00:00:00Z');
        const session = {
            id: 'session_1',
            psychologistId: 'psy_1',
            clientId: 'client_1',
            date: sessionDate,
            time: '13:00',
            status: 'confirmed',
            duration: 50,
            client: { name: 'Клиент' },
        };

        const findUnique = vi.fn().mockResolvedValue(session);
        const psychologistSettingsFindUnique = vi.fn().mockResolvedValue({ cancellationHours: 0, privateRemindersEnabled: false });
        const update = vi.fn().mockResolvedValue({});

        vi.doMock('@/lib/db', () => ({
            db: {
                diarySession: {
                    findUnique: (...args: unknown[]) => findUnique(...args),
                    update: (...args: unknown[]) => update(...args),
                },
                psychologistSettings: {
                    findUnique: (...args: unknown[]) => psychologistSettingsFindUnique(...args),
                },
            },
        }));
        vi.doMock('@/lib/calendar/auto-sync', () => ({
            autoDeleteSessionFromCalendars: vi.fn().mockResolvedValue(undefined),
        }));
        vi.doMock('@/lib/client-workflow', () => ({
            verifySessionActionToken: () => true,
        }));
        vi.doMock('@/lib/notifications', () => ({
            createNotification: vi.fn().mockResolvedValue(undefined),
        }));
        vi.doMock('@/lib/client-cancellation', () => ({
            canClientCancel: () => ({ allowed: true }),
            clientCancelBlockedMessage: () => '',
            isClientLinkExpired: () => false,
        }));

        const { GET } = await import('../src/app/api/client/session-action/route');
        const req = { nextUrl: { searchParams: new URLSearchParams({ s: 'session_1', a: 'cancel', t: 'token' }) } } as any;
        await GET(req);

        await new Promise((r) => setImmediate(r));

        expect(notifyWaitlistOnFreedSlot).toHaveBeenCalledWith('psy_1', sessionDate, '13:00');
    });
});
