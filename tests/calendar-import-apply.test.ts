// Task 11 (founder correction): apply/route.ts no longer re-derives a
// client by name — a name-only match is never an auto-decision (see
// src/lib/clients/match.ts). The preview UI must send an EXPLICIT
// resolution: either an existing client id the psychologist picked
// (resolvedClientId) or confirmation to create a new one (newClientName).
// A calendar-imported session still must carry origin='calendar_import'
// and clientNotificationsEnabled=false (Task 9).

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
const psychologistAddressFindFirst = vi.fn();
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
        psychologistAddress: {
            findFirst: (...args: unknown[]) => psychologistAddressFindFirst(...args),
        },
    },
}));

function req(body: unknown) {
    return { json: async () => body } as any;
}

const baseItem = { date: '2026-09-07', startTime: '09:00', endTime: '09:50', duration: 50, summary: 'Сессия — Иван Иванов' };

describe('POST /api/diary/calendar/import/apply (Task 11 correction)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        auth.mockResolvedValue({ user: { id: 'psy-1' } });
        diaryClientFindFirst.mockResolvedValue(null); // ownership lookup, per resolvedClientId case
        diaryClientCreate.mockResolvedValue({ id: 'client-new' });
        diarySessionFindFirst.mockResolvedValue(null);
        diarySessionCreate.mockResolvedValue({ id: 'session-1' });
        psychologistAddressFindFirst.mockResolvedValue(null);
    });

    it('creates the session with origin=calendar_import and clientNotificationsEnabled=false, for an explicit new client', async () => {
        const { POST } = await import('../src/app/api/diary/calendar/import/apply/route');
        await POST(req({ items: [{ ...baseItem, newClientName: 'Иван Иванов' }] }));

        expect(diaryClientCreate).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({ name: 'Иван Иванов' }),
        }));
        expect(diarySessionCreate).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({ origin: 'calendar_import', clientNotificationsEnabled: false, clientId: 'client-new' }),
        }));
    });

    it('never re-derives a client by name — a bare clientName with no explicit resolution is rejected, not silently matched', async () => {
        const { POST } = await import('../src/app/api/diary/calendar/import/apply/route');
        const res = await POST(req({ items: [{ ...baseItem, clientName: 'Иван Иванов' }] }));
        const body = await res.json();

        expect(diaryClientCreate).not.toHaveBeenCalled();
        expect(diarySessionCreate).not.toHaveBeenCalled();
        expect(body.imported).toBe(0);
        expect(body.skipped).toBe(1);
    });

    it('uses an explicitly resolved existing client id, after verifying ownership — never a name re-match', async () => {
        diaryClientFindFirst.mockResolvedValue({ id: 'client-1' }); // ownership check passes

        const { POST } = await import('../src/app/api/diary/calendar/import/apply/route');
        await POST(req({ items: [{ ...baseItem, resolvedClientId: 'client-1' }] }));

        expect(diaryClientCreate).not.toHaveBeenCalled();
        expect(diarySessionCreate).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({ clientId: 'client-1' }),
        }));
    });

    it('rejects a resolvedClientId that does not belong to this psychologist (ownership), never creates the session', async () => {
        diaryClientFindFirst.mockResolvedValue(null); // requireOwnedClient finds nothing -> OwnershipError

        const { POST } = await import('../src/app/api/diary/calendar/import/apply/route');
        const res = await POST(req({ items: [{ ...baseItem, resolvedClientId: 'someone-elses-client' }] }));
        const body = await res.json();

        expect(diarySessionCreate).not.toHaveBeenCalled();
        expect(body.skipped).toBe(1);
    });

    it('rejects an item that provides BOTH resolvedClientId and newClientName — an ambiguous resolution', async () => {
        const { POST } = await import('../src/app/api/diary/calendar/import/apply/route');
        const res = await POST(req({ items: [{ ...baseItem, resolvedClientId: 'client-1', newClientName: 'Иван Иванов' }] }));
        const body = await res.json();

        expect(diarySessionCreate).not.toHaveBeenCalled();
        expect(body.skipped).toBe(1);
    });

    it('an offline session with an OWNED addressId is created with that cabinet', async () => {
        psychologistAddressFindFirst.mockResolvedValue({ id: 'addr-1' });

        const { POST } = await import('../src/app/api/diary/calendar/import/apply/route');
        await POST(req({ items: [{ ...baseItem, newClientName: 'Иван Иванов', format: 'offline', addressId: 'addr-1' }] }));

        expect(diarySessionCreate).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({ format: 'offline', addressId: 'addr-1' }),
        }));
    });

    it('an offline session with a FOREIGN/unowned addressId is rejected — no session created', async () => {
        psychologistAddressFindFirst.mockResolvedValue(null); // requireOwnedAddress finds nothing -> OwnershipError

        const { POST } = await import('../src/app/api/diary/calendar/import/apply/route');
        const res = await POST(req({ items: [{ ...baseItem, newClientName: 'Иван Иванов', format: 'offline', addressId: 'someone-elses-address' }] }));
        const body = await res.json();

        expect(diarySessionCreate).not.toHaveBeenCalled();
        expect(body.skipped).toBe(1);
    });

    it('an offline session with NO addressId at all is rejected — never falls back to "no cabinet"', async () => {
        const { POST } = await import('../src/app/api/diary/calendar/import/apply/route');
        const res = await POST(req({ items: [{ ...baseItem, newClientName: 'Иван Иванов', format: 'offline' }] }));
        const body = await res.json();

        expect(diarySessionCreate).not.toHaveBeenCalled();
        expect(body.skipped).toBe(1);
    });

    it('an online session NEVER trusts a smuggled addressId from the body — always saved as null', async () => {
        const { POST } = await import('../src/app/api/diary/calendar/import/apply/route');
        await POST(req({ items: [{ ...baseItem, newClientName: 'Иван Иванов', format: 'online', addressId: 'addr-1' }] }));

        expect(diarySessionCreate).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({ format: 'online', addressId: null }),
        }));
        expect(psychologistAddressFindFirst).not.toHaveBeenCalled();
    });

    it('rejects a newClientName shorter than 2 characters', async () => {
        const { POST } = await import('../src/app/api/diary/calendar/import/apply/route');
        const res = await POST(req({ items: [{ ...baseItem, newClientName: 'И' }] }));
        const body = await res.json();

        expect(diarySessionCreate).not.toHaveBeenCalled();
        expect(body.skipped).toBe(1);
    });

    it('rejects a non-finite or non-positive duration', async () => {
        const { POST } = await import('../src/app/api/diary/calendar/import/apply/route');
        const res = await POST(req({ items: [{ ...baseItem, newClientName: 'Иван Иванов', duration: 0 }] }));
        const body = await res.json();

        expect(diarySessionCreate).not.toHaveBeenCalled();
        expect(body.skipped).toBe(1);
    });
});
