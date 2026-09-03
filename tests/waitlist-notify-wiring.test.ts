// O-260829 §5.2: notifyWaitlistOnFreedSlot должна вызываться из ОБОИХ мест,
// где час на самом деле освобождается — атомарный перенос
// (rescheduleSessionAtomic) и отмена клиентом по подписанной ссылке
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

    it('rescheduleSessionAtomic зовёт notifyWaitlistOnFreedSlot со СТАРЫМ (освободившимся) временем', async () => {
        const findUnique = vi.fn();
        const findMany = vi.fn().mockResolvedValue([]);
        const update = vi.fn();

        vi.doMock('@/lib/db', () => ({
            db: {
                diarySession: {
                    findUnique: (...args: unknown[]) => findUnique(...args),
                    findMany: (...args: unknown[]) => findMany(...args),
                    update: (...args: unknown[]) => update(...args),
                },
            },
        }));
        vi.doMock('@/lib/calendar/auto-sync', () => ({
            autoSyncSessionToCalendars: vi.fn().mockResolvedValue(undefined),
            autoDeleteSessionFromCalendars: vi.fn().mockResolvedValue(undefined),
        }));

        const oldDate = new Date('2026-09-10T00:00:00Z');
        const existing = {
            id: 'session_1',
            psychologistId: 'psy_1',
            date: oldDate,
            time: '10:00',
            duration: 50,
            status: 'confirmed',
        };
        findUnique.mockResolvedValueOnce(existing); // lookup before update
        update.mockResolvedValueOnce({ ...existing, date: new Date('2026-09-12T00:00:00Z'), time: '15:00' });
        findUnique.mockResolvedValueOnce({ ...existing, client: { name: 'Клиент' } }); // post-update fetch for calendar sync

        const { rescheduleSessionAtomic } = await import('../src/lib/session-reschedule');
        await rescheduleSessionAtomic('psy_1', 'session_1', new Date('2026-09-12T00:00:00Z'), '15:00');

        // Fire-and-forget внутри функции — дать микрозадачам отработать.
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
