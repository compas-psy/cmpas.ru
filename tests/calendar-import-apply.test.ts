// Task 11: apply/route.ts is now wired to a real UI. A calendar-imported
// session never went through our booking flow, so it must carry Task 9's
// provenance/communication-policy fields — origin='calendar_import',
// clientNotificationsEnabled=false — or it would silently get full
// automated client-facing messaging (reminders, mood-check nudges) for a
// client relationship the client never opted into via PRAKTIKA.

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

const diaryClientFindFirst = vi.fn();
const diaryClientCreate = vi.fn();
const diarySessionFindFirst = vi.fn();
const diarySessionCreate = vi.fn();
vi.mock('@/lib/db', () => ({
    db: {
        diaryClient: {
            findFirst: (...args: unknown[]) => diaryClientFindFirst(...args),
            create: (...args: unknown[]) => diaryClientCreate(...args),
        },
        diarySession: {
            findFirst: (...args: unknown[]) => diarySessionFindFirst(...args),
            create: (...args: unknown[]) => diarySessionCreate(...args),
        },
    },
}));

function req(body: unknown) {
    return { json: async () => body } as any;
}

describe('POST /api/diary/calendar/import/apply (Task 11)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        auth.mockResolvedValue({ user: { id: 'psy-1' } });
        diaryClientFindFirst.mockResolvedValue(null);
        diaryClientCreate.mockResolvedValue({ id: 'client-1' });
        diarySessionFindFirst.mockResolvedValue(null);
        diarySessionCreate.mockResolvedValue({ id: 'session-1' });
    });

    it('creates the session with origin=calendar_import and clientNotificationsEnabled=false', async () => {
        const { POST } = await import('../src/app/api/diary/calendar/import/apply/route');
        await POST(req({
            items: [{ clientName: 'Иван Иванов', date: '2026-09-07', startTime: '09:00', endTime: '09:50', duration: 50, summary: 'Сессия — Иван Иванов' }],
        }));

        expect(diarySessionCreate).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({ origin: 'calendar_import', clientNotificationsEnabled: false }),
        }));
    });
});
