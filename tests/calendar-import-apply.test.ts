// Task 12 (founder correction round 3): apply/route.ts is a thin front for
// commitPracticeImport(psychologistId, batchId) — it persists exactly what
// was submitted as a durable PracticeImportBatch/PracticeImportItem (the
// "evidence"), then delegates ALL validation/creation, including operator
// attestation, to the domain-level commit function (tested in isolation in
// tests/practice-import-commit.test.ts). This file tests only the route's
// own responsibilities: coercing the body into item rows, calling commit
// with the right argument order, and shaping the response.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const auth = vi.fn();
vi.mock('@/auth', () => ({ auth: (...args: unknown[]) => auth(...args) }));

vi.mock('@/lib/practice/attestation', () => ({
    ATTESTATION_REQUIRED_CODE: 'ATTESTATION_REQUIRED',
}));

const createNotification = vi.fn().mockResolvedValue(undefined);
vi.mock('@/lib/notifications', () => ({
    createNotification: (...args: unknown[]) => createNotification(...args),
}));

const practiceImportBatchCreate = vi.fn();
vi.mock('@/lib/db', () => ({
    db: {
        practiceImportBatch: {
            create: (...args: unknown[]) => practiceImportBatchCreate(...args),
        },
    },
}));

const commitPracticeImport = vi.fn();
class FakeCommitConflictError extends Error {
    code = 'COMMIT_IN_PROGRESS';
}
vi.mock('@/lib/practice/migration/commit', () => ({
    commitPracticeImport: (...args: unknown[]) => commitPracticeImport(...args),
    CommitConflictError: FakeCommitConflictError,
}));

function req(body: unknown) {
    return { json: async () => body } as any;
}

const baseItem = { date: '2026-09-07', startTime: '09:00', endTime: '09:50', duration: 50, summary: 'Сессия — Иван Иванов', classification: 'session', decision: 'session', clientMode: 'new', newClientName: 'Иван Иванов' };

describe('POST /api/diary/calendar/import/apply (Task 12)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        auth.mockResolvedValue({ user: { id: 'psy-1' } });
        practiceImportBatchCreate.mockResolvedValue({ id: 'batch-1' });
        commitPracticeImport.mockResolvedValue({
            batchId: 'batch-1', status: 'committed', imported: 1, skipped: 0, failed: 0,
            outcomes: [{ itemId: 'item-1', status: 'imported', createdSessionId: 'session-1' }],
        });
    });

    it('persists a durable batch (sourceType=calendar) with the submitted items before committing', async () => {
        const { POST } = await import('../src/app/api/diary/calendar/import/apply/route');
        await POST(req({ items: [baseItem] }));

        expect(practiceImportBatchCreate).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({
                psychologistId: 'psy-1',
                sourceType: 'calendar',
                items: { create: [expect.objectContaining({
                    classification: 'session',
                    resolution: expect.objectContaining({ decision: 'session', clientMode: 'new', newClientName: 'Иван Иванов', duration: 50 }),
                })] },
            }),
        }));
    });

    it('computes startAt/endAt via the deterministic date helper, not a bare new Date(dateStr)', async () => {
        const { POST } = await import('../src/app/api/diary/calendar/import/apply/route');
        await POST(req({ items: [baseItem] }));

        const created = practiceImportBatchCreate.mock.calls[0][0].data.items.create[0];
        expect(created.startAt.toISOString()).toBe('2026-09-07T09:00:00.000Z');
        expect(created.endAt.toISOString()).toBe('2026-09-07T09:50:00.000Z');
    });

    it('calls commitPracticeImport with (psychologistId, batchId) — psychologist first, the authorization boundary', async () => {
        const { POST } = await import('../src/app/api/diary/calendar/import/apply/route');
        await POST(req({ items: [baseItem] }));

        expect(commitPracticeImport).toHaveBeenCalledWith('psy-1', 'batch-1');
    });

    it('shapes the response from commitPracticeImport\'s result, including batchId and imported sessionIds', async () => {
        const { POST } = await import('../src/app/api/diary/calendar/import/apply/route');
        const res = await POST(req({ items: [baseItem] }));
        const body = await res.json();

        expect(body).toEqual({ imported: 1, skipped: 0, failed: 0, batchId: 'batch-1', sessionIds: ['session-1'] });
    });

    it('never creates a batch or calls commitPracticeImport for an empty item list', async () => {
        const { POST } = await import('../src/app/api/diary/calendar/import/apply/route');
        const res = await POST(req({ items: [] }));
        const body = await res.json();

        expect(commitPracticeImport).not.toHaveBeenCalled();
        expect(practiceImportBatchCreate).not.toHaveBeenCalled();
        expect(body).toEqual({ imported: 0, skipped: 0, failed: 0 });
    });

    it('propagates ATTESTATION_REQUIRED from commitPracticeImport as 403 — the route no longer checks it itself', async () => {
        commitPracticeImport.mockRejectedValue(new Error('ATTESTATION_REQUIRED'));

        const { POST } = await import('../src/app/api/diary/calendar/import/apply/route');
        const res = await POST(req({ items: [baseItem] }));

        expect(res.status).toBe(403);
        // The batch IS still persisted — it's a durable snapshot of what was
        // submitted, independent of whether the commit itself is allowed.
        expect(practiceImportBatchCreate).toHaveBeenCalled();
    });

    it('propagates a CommitConflictError (concurrent commit) as 409', async () => {
        commitPracticeImport.mockRejectedValue(new FakeCommitConflictError('COMMIT_IN_PROGRESS'));

        const { POST } = await import('../src/app/api/diary/calendar/import/apply/route');
        const res = await POST(req({ items: [baseItem] }));

        expect(res.status).toBe(409);
    });

    it('notifies the psychologist when at least one session was imported', async () => {
        const { POST } = await import('../src/app/api/diary/calendar/import/apply/route');
        await POST(req({ items: [baseItem] }));

        expect(createNotification).toHaveBeenCalledWith(expect.objectContaining({ psychologistId: 'psy-1', type: 'calendar_imported' }));
    });

    it('does not notify when nothing was imported', async () => {
        commitPracticeImport.mockResolvedValue({ batchId: 'batch-1', status: 'committed', imported: 0, skipped: 1, failed: 0, outcomes: [] });

        const { POST } = await import('../src/app/api/diary/calendar/import/apply/route');
        await POST(req({ items: [baseItem] }));

        expect(createNotification).not.toHaveBeenCalled();
    });

    it('caps a batch at 100 items', async () => {
        const items = Array.from({ length: 150 }, (_, i) => ({ ...baseItem, externalEventId: `evt-${i}` }));

        const { POST } = await import('../src/app/api/diary/calendar/import/apply/route');
        await POST(req({ items }));

        const createCall = practiceImportBatchCreate.mock.calls[0][0];
        expect(createCall.data.items.create).toHaveLength(100);
    });

    it('a client_only item gets no startAt/endAt fabricated', async () => {
        const { POST } = await import('../src/app/api/diary/calendar/import/apply/route');
        await POST(req({ items: [{ ...baseItem, classification: 'client_only' }] }));

        const created = practiceImportBatchCreate.mock.calls[0][0].data.items.create[0];
        expect(created.startAt).toBeNull();
        expect(created.endAt).toBeNull();
    });
});
