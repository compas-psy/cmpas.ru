// Task 12: apply/route.ts is now a thin front for commitPracticeImport —
// it persists exactly what was submitted as a durable PracticeImportBatch
// (the "evidence"), then delegates all actual validation/creation to the
// real transactional commit function (tested in isolation in
// tests/practice-import-commit.test.ts). This tests the route's own
// responsibilities: coercing the body into batch items, calling commit,
// and shaping the response — not re-testing commitOneItem's business rules.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const auth = vi.fn();
vi.mock('@/auth', () => ({ auth: (...args: unknown[]) => auth(...args) }));

const requirePracticeOperatorAttestation = vi.fn().mockResolvedValue(undefined);
vi.mock('@/lib/practice/attestation', () => ({
    requirePracticeOperatorAttestation: (...args: unknown[]) => requirePracticeOperatorAttestation(...args),
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
vi.mock('@/lib/practice/migration/commit', () => ({
    commitPracticeImport: (...args: unknown[]) => commitPracticeImport(...args),
}));

function req(body: unknown) {
    return { json: async () => body } as any;
}

const baseItem = { date: '2026-09-07', startTime: '09:00', endTime: '09:50', duration: 50, summary: 'Сессия — Иван Иванов', newClientName: 'Иван Иванов' };

describe('POST /api/diary/calendar/import/apply (Task 12)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        auth.mockResolvedValue({ user: { id: 'psy-1' } });
        requirePracticeOperatorAttestation.mockResolvedValue(undefined);
        practiceImportBatchCreate.mockResolvedValue({ id: 'batch-1' });
        commitPracticeImport.mockResolvedValue({
            batchId: 'batch-1', status: 'committed', imported: 1, skipped: 0, failed: 0,
            outcomes: [{ itemId: 'item-1', status: 'imported', sessionId: 'session-1' }],
        });
    });

    it('persists a durable batch with the submitted items before committing', async () => {
        const { POST } = await import('../src/app/api/diary/calendar/import/apply/route');
        await POST(req({ items: [baseItem] }));

        expect(practiceImportBatchCreate).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({
                psychologistId: 'psy-1',
                items: { create: [expect.objectContaining({ newClientName: 'Иван Иванов', startTime: '09:00', duration: 50 })] },
            }),
        }));
    });

    it('calls commitPracticeImport with the created batch id and psychologist id', async () => {
        const { POST } = await import('../src/app/api/diary/calendar/import/apply/route');
        await POST(req({ items: [baseItem] }));

        expect(commitPracticeImport).toHaveBeenCalledWith('batch-1', 'psy-1');
    });

    it('shapes the response from commitPracticeImport\'s result, including batchId and imported sessionIds', async () => {
        const { POST } = await import('../src/app/api/diary/calendar/import/apply/route');
        const res = await POST(req({ items: [baseItem] }));
        const body = await res.json();

        expect(body).toEqual({ imported: 1, skipped: 0, failed: 0, batchId: 'batch-1', sessionIds: ['session-1'] });
    });

    it('never calls commitPracticeImport for an empty item list', async () => {
        const { POST } = await import('../src/app/api/diary/calendar/import/apply/route');
        const res = await POST(req({ items: [] }));
        const body = await res.json();

        expect(commitPracticeImport).not.toHaveBeenCalled();
        expect(practiceImportBatchCreate).not.toHaveBeenCalled();
        expect(body).toEqual({ imported: 0, skipped: 0, failed: 0 });
    });

    it('requires operator attestation before creating a batch', async () => {
        requirePracticeOperatorAttestation.mockRejectedValue(new Error('ATTESTATION_REQUIRED'));

        const { POST } = await import('../src/app/api/diary/calendar/import/apply/route');
        const res = await POST(req({ items: [baseItem] }));

        expect(res.status).toBe(403);
        expect(practiceImportBatchCreate).not.toHaveBeenCalled();
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
});
