import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/telegram', () => ({ sendTelegramMessage: vi.fn() }));
vi.mock('@/lib/max', () => ({ sendMaxMessage: vi.fn() }));
vi.mock('@/lib/max-bot', () => ({ sendMaxMessage: vi.fn() }));

import { sendTelegramMessage } from '@/lib/telegram';
import { sendMaxMessage as sendMaxText } from '@/lib/max';
import { sendMaxMessage as sendMaxFull } from '@/lib/max-bot';
import {
    ensureOutboxRows,
    sendOutboxRow,
    markSent,
    markFailed,
    getReminderOutboxCounters,
    runOutboxOnce,
} from '@/lib/reminders/outbox';

const sendTelegramMock = vi.mocked(sendTelegramMessage);
const sendMaxTextMock = vi.mocked(sendMaxText);
const sendMaxFullMock = vi.mocked(sendMaxFull);

beforeEach(() => {
    sendTelegramMock.mockReset().mockResolvedValue(true);
    sendMaxTextMock.mockReset().mockResolvedValue({ ok: true } as unknown as ReturnType<typeof sendMaxText>);
    sendMaxFullMock.mockReset().mockResolvedValue({ ok: true } as unknown as ReturnType<typeof sendMaxFull>);
});

// ── A tiny in-memory stand-in for the slice of PrismaClient outbox.ts uses ──

interface FakeOutboxRow {
    id: string;
    sessionId: string;
    kind: string;
    dueAt: Date;
    status: string;
    attempts: number;
    sendCount: number;
    late: boolean;
    lastError?: string | null;
}

function makeFakeDb(sessions: any[], outboxRows: FakeOutboxRow[] = []) {
    let counter = 0;
    const db = {
        diarySession: {
            findMany: async ({ where }: any) => {
                return sessions
                    .filter((s) => where.status.in.includes(s.status) && s.date.getTime() >= where.date.gte.getTime())
                    .map((s) => ({ id: s.id, date: s.date, psychologist: { notificationSettings: s.notificationSettings ?? null } }));
            },
            findUnique: async ({ where }: any) => sessions.find((s) => s.id === where.id) ?? null,
        },
        reminderOutbox: {
            createMany: async ({ data }: any) => {
                for (const d of data) {
                    const exists = outboxRows.some((r) => r.sessionId === d.sessionId && r.kind === d.kind);
                    if (!exists) {
                        counter += 1;
                        outboxRows.push({ id: `row-${counter}`, status: 'pending', attempts: 0, sendCount: 0, late: false, ...d });
                    }
                }
                return { count: data.length };
            },
            findMany: async ({ where }: any) => outboxRows.filter((r) => (where?.status ? r.status === where.status : true)),
            update: async ({ where, data }: any) => {
                const row = outboxRows.find((r) => r.id === where.id);
                if (row) Object.assign(row, data);
                return row;
            },
            updateMany: async ({ where, data }: any) => {
                let count = 0;
                for (const row of outboxRows) {
                    if (row.id === where.id && (where.status === undefined || row.status === where.status)) {
                        Object.assign(row, typeof data.sendCount === 'object' ? { ...data, sendCount: row.sendCount + data.sendCount.increment } : data);
                        count += 1;
                    }
                }
                return { count };
            },
            findUnique: async ({ where }: any) => outboxRows.find((r) => r.id === where.id) ?? null,
            count: async ({ where }: any) => {
                return outboxRows.filter((r) => {
                    if (where.dueAt) return r.dueAt.getTime() <= where.dueAt.lte.getTime();
                    if (where.status) return r.status === where.status;
                    if (where.sendCount) return r.sendCount > where.sendCount.gt;
                    return true;
                }).length;
            },
        },
        $queryRaw: vi.fn(),
    };
    return { db, outboxRows };
}

function baseSession(overrides: Record<string, unknown> = {}) {
    return {
        id: 's1',
        date: new Date('2026-08-20T10:00:00Z'),
        time: '13:00',
        status: 'confirmed',
        format: 'online',
        psychologistId: 'psy1',
        clientId: 'c1',
        client: { id: 'c1', name: 'Клиент', telegramChatId: 'tg-client', maxChatId: null, telegramClient: null },
        psychologist: { name: 'Психолог', telegramChatId: 'tg-psy', maxChatId: null, psychologistSettings: null },
        address: null,
        ...overrides,
    };
}

describe('ensureOutboxRows (O-260817-16)', () => {
    it('creates all three kinds for an upcoming session with no notification settings row (defaults on)', async () => {
        const session = { id: 's1', date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), status: 'confirmed', notificationSettings: null };
        const { db, outboxRows } = makeFakeDb([session]);

        await ensureOutboxRows(db as any, new Date());

        expect(outboxRows.map((r) => r.kind).sort()).toEqual(['client_1h', 'client_24h', 'psychologist_reminder']);
    });

    it('does not create a row for a kind the psychologist has disabled', async () => {
        const session = {
            id: 's1',
            date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
            status: 'confirmed',
            notificationSettings: { reminderEnabled: false, clientReminder25hEnabled: true, clientReminder1hEnabled: true },
        };
        const { db, outboxRows } = makeFakeDb([session]);

        await ensureOutboxRows(db as any, new Date());

        expect(outboxRows.map((r) => r.kind).sort()).toEqual(['client_1h', 'client_24h']);
    });

    it('is idempotent — a second pass does not create duplicate rows for the same (session, kind)', async () => {
        const session = { id: 's1', date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), status: 'confirmed', notificationSettings: null };
        const { db, outboxRows } = makeFakeDb([session]);

        await ensureOutboxRows(db as any, new Date());
        await ensureOutboxRows(db as any, new Date());

        expect(outboxRows).toHaveLength(3);
    });

    it('refreshes dueAt on a pending row when the session is rescheduled', async () => {
        const originalDate = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
        const session = { id: 's1', date: originalDate, status: 'confirmed', notificationSettings: null };
        const { db, outboxRows } = makeFakeDb([session]);
        await ensureOutboxRows(db as any, new Date());

        const newDate = new Date(originalDate.getTime() + 6 * 60 * 60 * 1000); // moved 6h later
        session.date = newDate;
        await ensureOutboxRows(db as any, new Date());

        const client24h = outboxRows.find((r) => r.kind === 'client_24h')!;
        expect(client24h.dueAt.getTime()).toBe(newDate.getTime() - 24 * 60 * 60 * 1000);
        expect(outboxRows).toHaveLength(3); // still one row per kind, not a duplicate
    });

    it('marks a pending row as skipped once its session is no longer pending/confirmed (e.g. cancelled)', async () => {
        const session = { id: 's1', date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), status: 'confirmed', notificationSettings: null };
        const { db, outboxRows } = makeFakeDb([session]);
        await ensureOutboxRows(db as any, new Date());

        session.status = 'cancelled';
        await ensureOutboxRows(db as any, new Date());

        expect(outboxRows.every((r) => r.status === 'skipped')).toBe(true);
    });

    it('marks a pending row as skipped once its kind is disabled after the row was created', async () => {
        const session: any = { id: 's1', date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), status: 'confirmed', notificationSettings: null };
        const { db, outboxRows } = makeFakeDb([session]);
        await ensureOutboxRows(db as any, new Date());

        session.notificationSettings = { reminderEnabled: true, clientReminder25hEnabled: true, clientReminder1hEnabled: false };
        await ensureOutboxRows(db as any, new Date());

        const client1h = outboxRows.find((r) => r.kind === 'client_1h')!;
        expect(client1h.status).toBe('skipped');
        expect(outboxRows.find((r) => r.kind === 'client_24h')!.status).toBe('pending');
    });
});

describe('sendOutboxRow (O-260817-16)', () => {
    it('sends the neutral 24h client reminder text (build24hReminderText, product/practice/CJM_booking_v1.md §1.3), and a copy to the psychologist', async () => {
        const session = baseSession();
        const { db } = makeFakeDb([session]);

        const result = await sendOutboxRow(db as any, { id: 'row-1', sessionId: 's1', kind: 'client_24h', dueAt: new Date() });

        expect(result.ok).toBe(true);
        expect(sendTelegramMock).toHaveBeenCalledWith(
            'tg-client',
            expect.stringContaining('Напоминание о встрече'),
            expect.anything()
        );
        const clientText = sendTelegramMock.mock.calls.find((call) => call[0] === 'tg-client')![1];
        expect(clientText).not.toMatch(/психолог/i);
        expect(sendTelegramMock).toHaveBeenCalledWith('tg-psy', expect.stringContaining('Завтра в 13:00 сессия с клиентом Клиент'), expect.anything());
    });

    it('sends the 1h client reminder without a psychologist copy', async () => {
        const session = baseSession();
        const { db } = makeFakeDb([session]);

        await sendOutboxRow(db as any, { id: 'row-1', sessionId: 's1', kind: 'client_1h', dueAt: new Date() });

        expect(sendTelegramMock).toHaveBeenCalledTimes(1);
        expect(sendTelegramMock).toHaveBeenCalledWith('tg-client', expect.stringContaining('через 1 час'), expect.anything());
    });

    it('sends the psychologist_reminder only to the psychologist, not the client', async () => {
        const session = baseSession();
        const { db } = makeFakeDb([session]);

        await sendOutboxRow(db as any, { id: 'row-1', sessionId: 's1', kind: 'psychologist_reminder', dueAt: new Date() });

        expect(sendTelegramMock).toHaveBeenCalledTimes(1);
        expect(sendTelegramMock).toHaveBeenCalledWith('tg-psy', expect.stringContaining('Клиент'), expect.anything());
    });

    it('is not a failure when the session has no recipient reachable at all', async () => {
        const session = baseSession({ client: { id: 'c1', name: 'Клиент', telegramChatId: null, maxChatId: null, telegramClient: null } });
        const { db } = makeFakeDb([session]);

        const result = await sendOutboxRow(db as any, { id: 'row-1', sessionId: 's1', kind: 'client_1h', dueAt: new Date() });

        expect(result.ok).toBe(true);
        expect(sendTelegramMock).not.toHaveBeenCalled();
    });

    it('reports failure when the telegram send genuinely fails', async () => {
        sendTelegramMock.mockResolvedValue(false);
        const session = baseSession();
        const { db } = makeFakeDb([session]);

        const result = await sendOutboxRow(db as any, { id: 'row-1', sessionId: 's1', kind: 'client_1h', dueAt: new Date() });

        expect(result.ok).toBe(false);
        expect(result.error).toContain('telegram');
    });

    it('is not a failure when the session was cancelled after being claimed', async () => {
        const session = baseSession({ status: 'cancelled' });
        const { db } = makeFakeDb([session]);

        const result = await sendOutboxRow(db as any, { id: 'row-1', sessionId: 's1', kind: 'client_1h', dueAt: new Date() });

        expect(result.ok).toBe(true);
        expect(sendTelegramMock).not.toHaveBeenCalled();
    });

    it('fails when the session no longer exists', async () => {
        const { db } = makeFakeDb([]);
        const result = await sendOutboxRow(db as any, { id: 'row-1', sessionId: 'missing', kind: 'client_1h', dueAt: new Date() });
        expect(result.ok).toBe(false);
    });
});

describe('markSent / markFailed (O-260817-16)', () => {
    it('marks a row sent, increments sendCount, and flags it late when far past dueAt', async () => {
        const { db, outboxRows } = makeFakeDb([]);
        outboxRows.push({ id: 'row-1', sessionId: 's1', kind: 'client_1h', dueAt: new Date('2026-08-20T10:00:00Z'), status: 'sending', attempts: 1, sendCount: 0, late: false });

        await markSent(db as any, { id: 'row-1', sessionId: 's1', kind: 'client_1h', dueAt: new Date('2026-08-20T10:00:00Z') }, new Date('2026-08-20T10:30:00Z'));

        const row = outboxRows[0];
        expect(row.status).toBe('sent');
        expect(row.sendCount).toBe(1);
        expect(row.late).toBe(true); // 30 min after dueAt > 15 min threshold
    });

    it('does not mark late a send that lands within the threshold', async () => {
        const { db, outboxRows } = makeFakeDb([]);
        outboxRows.push({ id: 'row-1', sessionId: 's1', kind: 'client_1h', dueAt: new Date('2026-08-20T10:00:00Z'), status: 'sending', attempts: 1, sendCount: 0, late: false });

        await markSent(db as any, { id: 'row-1', sessionId: 's1', kind: 'client_1h', dueAt: new Date('2026-08-20T10:00:00Z') }, new Date('2026-08-20T10:05:00Z'));

        expect(outboxRows[0].late).toBe(false);
    });

    it('retries a failed send (status back to pending) while under the attempt limit', async () => {
        const { db, outboxRows } = makeFakeDb([]);
        outboxRows.push({ id: 'row-1', sessionId: 's1', kind: 'client_1h', dueAt: new Date(), status: 'sending', attempts: 2, sendCount: 0, late: false });

        await markFailed(db as any, { id: 'row-1', sessionId: 's1', kind: 'client_1h', dueAt: new Date() }, 'boom', 2);

        expect(outboxRows[0].status).toBe('pending');
        expect(outboxRows[0].lastError).toBe('boom');
    });

    it('gives up (status failed) once attempts reach the limit', async () => {
        const { db, outboxRows } = makeFakeDb([]);
        outboxRows.push({ id: 'row-1', sessionId: 's1', kind: 'client_1h', dueAt: new Date(), status: 'sending', attempts: 5, sendCount: 0, late: false });

        await markFailed(db as any, { id: 'row-1', sessionId: 's1', kind: 'client_1h', dueAt: new Date() }, 'boom', 5);

        expect(outboxRows[0].status).toBe('failed');
    });
});

describe('getReminderOutboxCounters (O-260817-16, TZ_management_dashboard.md §9.6)', () => {
    it('computes due / sent / sentTwice from stored rows, not derived flags', async () => {
        const now = new Date('2026-08-20T12:00:00Z');
        const { db, outboxRows } = makeFakeDb([]);
        outboxRows.push(
            { id: 'r1', sessionId: 's1', kind: 'client_24h', dueAt: new Date('2026-08-20T11:00:00Z'), status: 'sent', attempts: 1, sendCount: 1, late: false },
            { id: 'r2', sessionId: 's1', kind: 'client_1h', dueAt: new Date('2026-08-20T13:00:00Z'), status: 'pending', attempts: 0, sendCount: 0, late: false }, // not due yet
            { id: 'r3', sessionId: 's2', kind: 'client_24h', dueAt: new Date('2026-08-20T10:00:00Z'), status: 'failed', attempts: 5, sendCount: 0, late: false },
            { id: 'r4', sessionId: 's3', kind: 'client_24h', dueAt: new Date('2026-08-20T09:00:00Z'), status: 'sent', attempts: 1, sendCount: 2, late: false } // structurally shouldn't happen, dashboard should still see it
        );

        const counters = await getReminderOutboxCounters(db as any, now);

        expect(counters.due).toBe(3); // r1, r3, r4 — r2 not due yet
        expect(counters.sent).toBe(2); // r1, r4
        expect(counters.sentTwice).toBe(1); // r4
    });
});

describe('runOutboxOnce (O-260817-16)', () => {
    it('schedules, claims via $queryRaw, sends, and finalizes in one pass', async () => {
        const session = baseSession({ date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000) });
        const { db, outboxRows } = makeFakeDb([session]);
        const claimedRow = { id: 'row-1', sessionId: 's1', kind: 'client_1h', dueAt: new Date() };
        (db.$queryRaw as any).mockResolvedValue([claimedRow]);
        outboxRows.push({ ...claimedRow, status: 'sending', attempts: 1, sendCount: 0, late: false });

        const result = await runOutboxOnce(db as any, 'worker-1');

        expect(result).toEqual({ claimed: 1, sent: 1, failed: 0 });
        expect(outboxRows.find((r) => r.id === 'row-1')!.status).toBe('sent');
    });

    it('counts a genuine send failure without throwing', async () => {
        sendTelegramMock.mockResolvedValue(false);
        const session = baseSession();
        const { db, outboxRows } = makeFakeDb([session]);
        const claimedRow = { id: 'row-1', sessionId: 's1', kind: 'client_1h', dueAt: new Date() };
        (db.$queryRaw as any).mockResolvedValue([claimedRow]);
        outboxRows.push({ ...claimedRow, status: 'sending', attempts: 1, sendCount: 0, late: false });

        const result = await runOutboxOnce(db as any, 'worker-1');

        expect(result).toEqual({ claimed: 1, sent: 0, failed: 1 });
        expect(outboxRows.find((r) => r.id === 'row-1')!.status).toBe('pending'); // retried, attempts (1) below MAX_ATTEMPTS
    });
});
