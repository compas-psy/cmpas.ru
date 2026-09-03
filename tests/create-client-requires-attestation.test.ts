// Task 5 (PRAKTIKA MVP): a psychologist must attest, once, that they are
// the operator of their clients' personal data before ANY new client is
// created or imported. This is the gate wired into createClient and
// bulkCreateClients (src/app/diary/actions/clients.ts) — it must never
// apply to viewing/editing existing records, only to creating a new one.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const auth = vi.fn();
vi.mock('@/auth', () => ({ auth: (...args: unknown[]) => auth(...args) }));

const revalidatePath = vi.fn();
vi.mock('next/cache', () => ({ revalidatePath: (...args: unknown[]) => revalidatePath(...args) }));

const diaryClientCreate = vi.fn();
const diaryClientFindMany = vi.fn();
const attestationFindFirst = vi.fn();

vi.mock('@/lib/db', () => ({
    db: {
        diaryClient: {
            create: (...args: unknown[]) => diaryClientCreate(...args),
            findMany: (...args: unknown[]) => diaryClientFindMany(...args),
        },
        practiceOperatorAttestation: {
            findFirst: (...args: unknown[]) => attestationFindFirst(...args),
        },
    },
}));

vi.mock('@/lib/calendar/google', () => ({ fetchGoogleCalendarEvents: vi.fn() }));
vi.mock('@/lib/calendar/yandex', () => ({ fetchYandexCalendarEvents: vi.fn() }));
vi.mock('@/lib/clients/extract-name', () => ({ aggregateCandidates: vi.fn() }));
vi.mock('@/lib/client-workflow', () => ({ clientBookingLink: vi.fn() }));
vi.mock('@/lib/booking/slug', () => ({ getPsychologistBookingUrl: vi.fn() }));

const { createClient, bulkCreateClients } = await import('../src/app/diary/actions/clients');

describe('createClient / bulkCreateClients — gated by practice operator attestation', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        auth.mockResolvedValue({ user: { id: 'psy-1' } });
        diaryClientFindMany.mockResolvedValue([]);
    });

    it('does not create client before operator attestation', async () => {
        attestationFindFirst.mockResolvedValue(null);

        await expect(createClient({ name: 'Новый клиент' })).rejects.toThrow('ATTESTATION_REQUIRED');
        expect(diaryClientCreate).not.toHaveBeenCalled();
    });

    it('creates the client once attestation exists', async () => {
        attestationFindFirst.mockResolvedValue({ id: 'attestation-1' });
        diaryClientCreate.mockResolvedValue({ id: 'client-1', name: 'Новый клиент' });

        const client = await createClient({ name: 'Новый клиент' });

        expect(client.id).toBe('client-1');
        expect(diaryClientCreate).toHaveBeenCalledTimes(1);
    });

    it('bulkCreateClients also refuses before attestation, without creating any row', async () => {
        attestationFindFirst.mockResolvedValue(null);

        await expect(bulkCreateClients([{ name: 'Иван Иванов' }])).rejects.toThrow('ATTESTATION_REQUIRED');
        expect(diaryClientCreate).not.toHaveBeenCalled();
    });

    it('bulkCreateClients with an empty batch never triggers the gate at all', async () => {
        attestationFindFirst.mockResolvedValue(null);

        const result = await bulkCreateClients([]);

        expect(result).toEqual({ created: 0, skipped: 0 });
        expect(attestationFindFirst).not.toHaveBeenCalled();
    });

    it('the gate is scoped per-psychologist — one attesting does not unlock another', async () => {
        attestationFindFirst.mockImplementation(({ where }: any) =>
            Promise.resolve(where.psychologistId === 'psy-1' ? { id: 'a1' } : null),
        );

        auth.mockResolvedValue({ user: { id: 'psy-1' } });
        diaryClientCreate.mockResolvedValue({ id: 'c1' });
        await expect(createClient({ name: 'A' })).resolves.toMatchObject({ id: 'c1' });

        auth.mockResolvedValue({ user: { id: 'psy-2' } });
        await expect(createClient({ name: 'B' })).rejects.toThrow('ATTESTATION_REQUIRED');
    });
});
