// Task 13: apply/route.ts is a thin front for commitPracticeImport, same
// pattern as the calendar import apply route (tests/calendar-import-apply.test.ts).
// This file tests only the route's own responsibilities: coercing the body
// into item rows for both modes, recomputing the fingerprint server-side
// (never trusting a client-submitted one), and shaping the response —
// domain logic itself is covered in tests/practice-import-commit-spreadsheet.test.ts.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const auth = vi.fn();
vi.mock('@/auth', () => ({ auth: (...args: unknown[]) => auth(...args) }));

vi.mock('@/lib/practice/attestation', () => ({ ATTESTATION_REQUIRED_CODE: 'ATTESTATION_REQUIRED' }));

const createNotification = vi.fn().mockResolvedValue(undefined);
vi.mock('@/lib/notifications', () => ({ createNotification: (...args: unknown[]) => createNotification(...args) }));

const practiceImportBatchCreate = vi.fn();
vi.mock('@/lib/db', () => ({
    db: { practiceImportBatch: { create: (...args: unknown[]) => practiceImportBatchCreate(...args) } },
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

describe('POST /api/diary/clients/import-spreadsheet/apply — client_only mode', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        auth.mockResolvedValue({ user: { id: 'psy-1' } });
        practiceImportBatchCreate.mockResolvedValue({ id: 'batch-1' });
        commitPracticeImport.mockResolvedValue({ batchId: 'batch-1', status: 'committed', imported: 1, skipped: 0, failed: 0, outcomes: [] });
    });

    it('persists sourceType=client_only with startAt/endAt/sourceFingerprint null', async () => {
        const { POST } = await import('../src/app/api/diary/clients/import-spreadsheet/apply/route');
        await POST(req({ mode: 'client_only', items: [{ clientMode: 'new', name: 'Анна Иванова', phone: '+79161234567', email: null }] }));

        expect(practiceImportBatchCreate).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({
                psychologistId: 'psy-1',
                sourceType: 'client_only',
                items: { create: [expect.objectContaining({
                    classification: 'client_only', startAt: null, endAt: null, sourceFingerprint: null,
                    resolution: expect.objectContaining({ clientMode: 'new', newClientName: 'Анна Иванова', newClientPhone: '+79161234567' }),
                })] },
            }),
        }));
    });

    it('calls commitPracticeImport with (psychologistId, batchId)', async () => {
        const { POST } = await import('../src/app/api/diary/clients/import-spreadsheet/apply/route');
        await POST(req({ mode: 'client_only', items: [{ clientMode: 'new', name: 'Анна' }] }));
        expect(commitPracticeImport).toHaveBeenCalledWith('psy-1', 'batch-1');
    });
});

describe('POST /api/diary/clients/import-spreadsheet/apply — spreadsheet (session) mode', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        auth.mockResolvedValue({ user: { id: 'psy-1' } });
        practiceImportBatchCreate.mockResolvedValue({ id: 'batch-1' });
        commitPracticeImport.mockResolvedValue({ batchId: 'batch-1', status: 'committed', imported: 1, skipped: 0, failed: 0, outcomes: [] });
    });

    const sessionItem = { clientMode: 'new', name: 'Анна Иванова', phone: '+79161234567', email: null, date: '2026-09-12', startTime: '15:00', endTime: '15:50', duration: 50, format: 'online', addressId: null };

    it('persists sourceType=spreadsheet with startAt/endAt via the deterministic date helper', async () => {
        const { POST } = await import('../src/app/api/diary/clients/import-spreadsheet/apply/route');
        await POST(req({ mode: 'spreadsheet', items: [sessionItem] }));

        const created = practiceImportBatchCreate.mock.calls[0][0].data.items.create[0];
        expect(created.classification).toBe('session');
        expect(created.startAt.toISOString()).toBe('2026-09-12T15:00:00.000Z');
        expect(created.endAt.toISOString()).toBe('2026-09-12T15:50:00.000Z');
    });

    it('recomputes sourceFingerprint server-side deterministically — a spoofed client-submitted fingerprint is ignored since none is even read from the body', async () => {
        const { POST } = await import('../src/app/api/diary/clients/import-spreadsheet/apply/route');
        await POST(req({ mode: 'spreadsheet', items: [{ ...sessionItem, sourceFingerprint: 'attacker-controlled-value' }] }));
        await POST(req({ mode: 'spreadsheet', items: [sessionItem] }));

        const first = practiceImportBatchCreate.mock.calls[0][0].data.items.create[0].sourceFingerprint;
        const second = practiceImportBatchCreate.mock.calls[1][0].data.items.create[0].sourceFingerprint;
        expect(first).toBe(second); // identical regardless of the spoofed field
        expect(first).toMatch(/^[0-9a-f]{64}$/);
    });

    it('never sets integrationId/externalEventId — spreadsheet rows are never linked to a calendar', async () => {
        const { POST } = await import('../src/app/api/diary/clients/import-spreadsheet/apply/route');
        await POST(req({ mode: 'spreadsheet', items: [sessionItem] }));
        const created = practiceImportBatchCreate.mock.calls[0][0].data.items.create[0];
        expect(created.integrationId).toBeUndefined();
        expect(created.externalEventId).toBeUndefined();
    });

    it('rejects an unrecognized mode', async () => {
        const { POST } = await import('../src/app/api/diary/clients/import-spreadsheet/apply/route');
        const res = await POST(req({ mode: 'bogus', items: [sessionItem] }));
        expect(res.status).toBe(400);
    });
});

describe('POST /api/diary/clients/import-spreadsheet/apply — attestation & conflict passthrough', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        auth.mockResolvedValue({ user: { id: 'psy-1' } });
        practiceImportBatchCreate.mockResolvedValue({ id: 'batch-1' });
    });

    it('surfaces ATTESTATION_REQUIRED as HTTP 403', async () => {
        commitPracticeImport.mockRejectedValue(new Error('ATTESTATION_REQUIRED'));
        const { POST } = await import('../src/app/api/diary/clients/import-spreadsheet/apply/route');
        const res = await POST(req({ mode: 'client_only', items: [{ clientMode: 'new', name: 'Анна' }] }));
        expect(res.status).toBe(403);
    });

    it('surfaces a concurrent-commit conflict as HTTP 409', async () => {
        commitPracticeImport.mockRejectedValue(new FakeCommitConflictError('COMMIT_IN_PROGRESS'));
        const { POST } = await import('../src/app/api/diary/clients/import-spreadsheet/apply/route');
        const res = await POST(req({ mode: 'client_only', items: [{ clientMode: 'new', name: 'Анна' }] }));
        expect(res.status).toBe(409);
    });

    it('returns 401 without a session', async () => {
        auth.mockResolvedValue(null);
        const { POST } = await import('../src/app/api/diary/clients/import-spreadsheet/apply/route');
        const res = await POST(req({ mode: 'client_only', items: [] }));
        expect(res.status).toBe(401);
    });
});
