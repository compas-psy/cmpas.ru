// Task 11 (founder correction, item 4): bulkCreateClients used to treat a
// case-insensitive NAME match against an existing client as a duplicate and
// silently skip it. Two different people can share a name — this is the
// required regression proving a name-only collision is never auto-matched
// and never silently skipped, while a real strong (phone) duplicate still
// is.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const auth = vi.fn();
vi.mock('@/auth', () => ({ auth: (...args: unknown[]) => auth(...args) }));

const revalidatePath = vi.fn();
vi.mock('next/cache', () => ({ revalidatePath: (...args: unknown[]) => revalidatePath(...args) }));

const attestationFindFirst = vi.fn().mockResolvedValue({ id: 'attestation-1' });
const diaryClientCreate = vi.fn();
const diaryClientFindMany = vi.fn();
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

vi.mock('@/lib/client-workflow', () => ({ clientBookingLink: vi.fn() }));
vi.mock('@/lib/booking/slug', () => ({ getPsychologistBookingUrl: vi.fn() }));

const { bulkCreateClients } = await import('../src/app/diary/actions/clients');

const IVAN_IN_DB = { id: 'client-1', name: 'Иван Иванов', phone: '+79001234567', email: null };

describe('bulkCreateClients — name is not identity (Task 11 correction)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        auth.mockResolvedValue({ user: { id: 'psy-1' } });
        attestationFindFirst.mockResolvedValue({ id: 'attestation-1' });
    });

    it('в базе Иван Иванов с телефоном, импорт "Иван Иванов" без телефона → НЕ auto-match и НЕ silent skip', async () => {
        diaryClientFindMany.mockResolvedValue([IVAN_IN_DB]);

        const result = await bulkCreateClients([{ name: 'Иван Иванов' }]);

        expect(diaryClientCreate).not.toHaveBeenCalled();
        expect(result.created).toBe(0);
        expect(result.skipped).toBe(0);
        expect(result.review).toEqual([
            { name: 'Иван Иванов', status: 'review', reason: 'NAME_ONLY_COLLISION', suggestedClientIds: ['client-1'] },
        ]);
    });

    it('в базе Иван Иванов +79001234567, импорт Иван Иванов +79001234567 → strong duplicate допустим (skip)', async () => {
        diaryClientFindMany.mockResolvedValue([IVAN_IN_DB]);

        const result = await bulkCreateClients([{ name: 'Иван Иванов', phone: '89001234567' }]);

        expect(diaryClientCreate).not.toHaveBeenCalled();
        expect(result.created).toBe(0);
        expect(result.skipped).toBe(1);
        expect(result.review).toEqual([]);
    });

    it('batch: "Иван Иванов" +79001111111 then "Иван Иванов" +79002222222 → the second is NOT silently skipped (different phone = different person)', async () => {
        diaryClientFindMany.mockResolvedValue([]);
        diaryClientCreate.mockResolvedValueOnce({ id: 'client-a' });

        const result = await bulkCreateClients([
            { name: 'Иван Иванов', phone: '+79001111111' },
            { name: 'Иван Иванов', phone: '+79002222222' },
        ]);

        expect(diaryClientCreate).toHaveBeenCalledTimes(1);
        expect(result.created).toBe(1);
        expect(result.skipped).toBe(0);
        expect(result.review).toEqual([
            { name: 'Иван Иванов', status: 'review', reason: 'NAME_ONLY_COLLISION', suggestedClientIds: ['client-a'] },
        ]);
    });

    it('batch: "Иван Иванов" +79001111111 then "Иван Иванов" 89001111111 (same phone, different formatting) → strong duplicate, skip is fine', async () => {
        diaryClientFindMany.mockResolvedValue([]);
        diaryClientCreate.mockResolvedValueOnce({ id: 'client-a' });

        const result = await bulkCreateClients([
            { name: 'Иван Иванов', phone: '+79001111111' },
            { name: 'Иван Иванов', phone: '89001111111' },
        ]);

        expect(diaryClientCreate).toHaveBeenCalledTimes(1);
        expect(result.created).toBe(1);
        expect(result.skipped).toBe(1);
        expect(result.review).toEqual([]);
    });

    it('a genuinely new name with no existing match is created normally', async () => {
        diaryClientFindMany.mockResolvedValue([IVAN_IN_DB]);
        diaryClientCreate.mockResolvedValue({ id: 'client-2' });

        const result = await bulkCreateClients([{ name: 'Совсем Другой' }]);

        expect(diaryClientCreate).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({ name: 'Совсем Другой' }),
        }));
        expect(result.created).toBe(1);
        expect(result.review).toEqual([]);
    });
});
