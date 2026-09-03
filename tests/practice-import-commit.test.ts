// Task 12 (PRAKTIKA MVP): commitPracticeImport(batchId) is the atomic,
// idempotent replacement for apply/route.ts's old inline per-item loop.
// This exercises the real transactional logic (commit.ts) against an
// in-memory fake db — same pattern tests/mobile-idempotency.test.ts uses
// for booking.ts's $transaction + advisory lock (`$transaction: async (fn)
// => fn(db)`), since Postgres advisory locks and unique constraints aren't
// available without a real database in this suite.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Prisma } from '@prisma/client';

interface FakeClient { id: string; psychologistId: string; name: string; status: string }
interface FakeAddress { id: string; psychologistId: string }
interface FakeSession { id: string; psychologistId: string; clientId: string; date: Date; time: string; status: string; [k: string]: unknown }
interface FakeLink { id: string; psychologistId: string; sessionId: string; integrationId: string; externalEventId: string; externalSeriesId: string | null }
interface FakeBatchItem {
    id: string; batchId: string; provider: string; integrationId: string; externalEventId: string; externalSeriesId: string | null;
    summary: string; date: Date; startTime: string; endTime: string | null; duration: number; format: string; addressId: string | null;
    resolvedClientId: string | null; newClientName: string | null;
    outcomeStatus: string; outcomeReason: string | null; sessionId: string | null;
}
interface FakeBatch { id: string; psychologistId: string; status: string; imported: number; skipped: number; failed: number }

function sameDay(a: Date, b: Date) {
    return a.toISOString().slice(0, 10) === b.toISOString().slice(0, 10);
}

function makeFakeDb() {
    let seq = 0;
    const nextId = (p: string) => `${p}-${++seq}`;

    const clients: FakeClient[] = [];
    const addresses: FakeAddress[] = [];
    const sessions: FakeSession[] = [];
    const links: FakeLink[] = [];
    const batches: FakeBatch[] = [];
    const items: FakeBatchItem[] = [];

    const db: any = {
        $transaction: async (fn: any) => fn(db),
        $executeRaw: async () => undefined,

        diaryClient: {
            findFirst: async ({ where }: any) => clients.find((c) => c.id === where.id && c.psychologistId === where.psychologistId) || null,
            create: async ({ data }: any) => { const c = { id: nextId('client'), status: 'active', ...data }; clients.push(c); return c; },
        },
        psychologistAddress: {
            findFirst: async ({ where }: any) => addresses.find((a) => a.id === where.id && a.psychologistId === where.psychologistId) || null,
        },
        diarySession: {
            findFirst: async ({ where }: any) =>
                sessions.find((s) => s.psychologistId === where.psychologistId && s.clientId === where.clientId && s.time === where.time && sameDay(s.date, where.date.gte) && s.status !== 'cancelled') || null,
            create: async ({ data }: any) => { const s = { id: nextId('session'), status: 'pending', ...data }; sessions.push(s); return s; },
        },
        calendarSessionLink: {
            findUnique: async ({ where }: any) => {
                const key = where.integrationId_externalEventId;
                return links.find((l) => l.integrationId === key.integrationId && l.externalEventId === key.externalEventId) || null;
            },
            create: async ({ data }: any) => {
                if (links.some((l) => l.integrationId === data.integrationId && l.externalEventId === data.externalEventId)) {
                    throw new Prisma.PrismaClientKnownRequestError('Unique constraint failed', { code: 'P2002', clientVersion: 'test' });
                }
                const l = { id: nextId('link'), ...data }; links.push(l); return l;
            },
        },
        practiceImportBatch: {
            findFirst: async ({ where }: any) => {
                const batch = batches.find((b) => b.id === where.id && b.psychologistId === where.psychologistId);
                if (!batch) return null;
                return { ...batch, items: items.filter((i) => i.batchId === batch.id) };
            },
            create: async ({ data }: any) => {
                const batch: FakeBatch = { id: nextId('batch'), status: 'pending', imported: 0, skipped: 0, failed: 0, psychologistId: data.psychologistId };
                batches.push(batch);
                for (const raw of data.items.create) {
                    items.push({ id: nextId('item'), batchId: batch.id, outcomeStatus: 'pending', outcomeReason: null, sessionId: null, ...raw });
                }
                return batch;
            },
            update: async ({ where, data }: any) => {
                const batch = batches.find((b) => b.id === where.id)!;
                Object.assign(batch, data);
                return batch;
            },
        },
        practiceImportBatchItem: {
            findMany: async ({ where }: any) => items.filter((i) => i.batchId === where.batchId),
            update: async ({ where, data }: any) => {
                const item = items.find((i) => i.id === where.id)!;
                Object.assign(item, data);
                return item;
            },
        },
    };

    return { db, clients, addresses, sessions, links, batches, items };
}

let fake: ReturnType<typeof makeFakeDb>;
vi.mock('@/lib/db', () => ({ get db() { return fake.db; } }));

const { commitPracticeImport } = await import('../src/lib/practice/migration/commit');

function baseItem(overrides: Record<string, unknown> = {}) {
    return {
        provider: 'google',
        integrationId: 'integration-1',
        externalEventId: 'evt-1',
        externalSeriesId: null,
        summary: 'Сессия — Иван Иванов',
        date: new Date('2026-09-07T00:00:00.000Z'),
        startTime: '09:00',
        endTime: '09:50',
        duration: 50,
        format: 'online',
        addressId: null,
        resolvedClientId: null,
        newClientName: 'Иван Иванов',
        ...overrides,
    };
}

async function createBatch(psychologistId: string, itemsData: ReturnType<typeof baseItem>[]) {
    return fake.db.practiceImportBatch.create({ data: { psychologistId, items: { create: itemsData } } });
}

describe('commitPracticeImport (Task 12)', () => {
    beforeEach(() => {
        fake = makeFakeDb();
    });

    it('imports a new-client item: creates the DiaryClient, the DiarySession, and a CalendarSessionLink', async () => {
        const batch = await createBatch('psy-1', [baseItem()]);
        const result = await commitPracticeImport(batch.id, 'psy-1');

        expect(result.imported).toBe(1);
        expect(result.skipped).toBe(0);
        expect(result.failed).toBe(0);
        expect(fake.sessions).toHaveLength(1);
        expect(fake.sessions[0]).toMatchObject({ origin: 'calendar_import', clientNotificationsEnabled: false });
        expect(fake.links).toHaveLength(1);
        expect(fake.links[0]).toMatchObject({ integrationId: 'integration-1', externalEventId: 'evt-1', sessionId: fake.sessions[0].id });
    });

    it('is idempotent: committing the SAME external event a second time (a fresh batch) skips it, never creates a second session', async () => {
        const batch1 = await createBatch('psy-1', [baseItem()]);
        await commitPracticeImport(batch1.id, 'psy-1');
        expect(fake.sessions).toHaveLength(1);

        const batch2 = await createBatch('psy-1', [baseItem({ newClientName: 'Иван Иванов (повтор)' })]);
        const result2 = await commitPracticeImport(batch2.id, 'psy-1');

        expect(result2.imported).toBe(0);
        expect(result2.skipped).toBe(1);
        expect(result2.outcomes[0].reason).toBe('ALREADY_IMPORTED');
        expect(fake.sessions).toHaveLength(1); // still just the one
    });

    it('re-committing the SAME batch (status already committed) returns the persisted outcome instead of re-processing', async () => {
        const batch = await createBatch('psy-1', [baseItem()]);
        const first = await commitPracticeImport(batch.id, 'psy-1');
        const second = await commitPracticeImport(batch.id, 'psy-1');

        expect(second).toEqual(first);
        expect(fake.sessions).toHaveLength(1);
    });

    it('rejects a resolvedClientId that does not belong to this psychologist — item fails, no session created', async () => {
        fake.clients.push({ id: 'client-other', psychologistId: 'psy-OTHER', name: 'Кто-то', status: 'active' });
        const batch = await createBatch('psy-1', [baseItem({ newClientName: null, resolvedClientId: 'client-other' })]);
        const result = await commitPracticeImport(batch.id, 'psy-1');

        expect(result.imported).toBe(0);
        expect(result.failed).toBe(1);
        expect(result.outcomes[0].reason).toBe('CLIENT_NOT_OWNED');
        expect(fake.sessions).toHaveLength(0);
    });

    it('rejects an offline item with no addressId — never falls back to "no cabinet"', async () => {
        const batch = await createBatch('psy-1', [baseItem({ format: 'offline', addressId: null })]);
        const result = await commitPracticeImport(batch.id, 'psy-1');

        expect(result.failed).toBe(1);
        expect(result.outcomes[0].reason).toBe('ADDRESS_REQUIRED');
        expect(fake.sessions).toHaveLength(0);
    });

    it('rejects an offline item with a foreign/unowned addressId', async () => {
        const batch = await createBatch('psy-1', [baseItem({ format: 'offline', addressId: 'someone-elses-address' })]);
        const result = await commitPracticeImport(batch.id, 'psy-1');

        expect(result.failed).toBe(1);
        expect(result.outcomes[0].reason).toBe('ADDRESS_NOT_OWNED');
    });

    it('imports an offline item with an owned addressId', async () => {
        fake.addresses.push({ id: 'addr-1', psychologistId: 'psy-1' });
        const batch = await createBatch('psy-1', [baseItem({ format: 'offline', addressId: 'addr-1' })]);
        const result = await commitPracticeImport(batch.id, 'psy-1');

        expect(result.imported).toBe(1);
        expect(fake.sessions[0]).toMatchObject({ format: 'offline', addressId: 'addr-1' });
    });

    it('rejects an item with both resolvedClientId and newClientName (ambiguous)', async () => {
        const batch = await createBatch('psy-1', [baseItem({ resolvedClientId: 'client-x' })]); // newClientName also set by baseItem
        const result = await commitPracticeImport(batch.id, 'psy-1');

        expect(result.failed).toBe(1);
        expect(result.outcomes[0].reason).toBe('AMBIGUOUS_CLIENT_RESOLUTION');
    });

    it('rejects a non-finite or non-positive duration', async () => {
        const batch = await createBatch('psy-1', [baseItem({ duration: 0 })]);
        const result = await commitPracticeImport(batch.id, 'psy-1');

        expect(result.failed).toBe(1);
        expect(result.outcomes[0].reason).toBe('INVALID_DURATION');
    });

    it('skips a session already existing at the same date+time+client (session-level dedupe, independent of the link check)', async () => {
        fake.clients.push({ id: 'client-1', psychologistId: 'psy-1', name: 'Иван Иванов', status: 'active' });
        fake.sessions.push({ id: 'session-existing', psychologistId: 'psy-1', clientId: 'client-1', date: new Date('2026-09-07T00:00:00.000Z'), time: '09:00', status: 'confirmed' });

        const batch = await createBatch('psy-1', [baseItem({ newClientName: null, resolvedClientId: 'client-1' })]);
        const result = await commitPracticeImport(batch.id, 'psy-1');

        expect(result.skipped).toBe(1);
        expect(result.outcomes[0].reason).toBe('SESSION_ALREADY_EXISTS');
    });

    it('writes the per-item outcome back onto the batch item row — the durable evidence', async () => {
        const batch = await createBatch('psy-1', [baseItem()]);
        await commitPracticeImport(batch.id, 'psy-1');

        expect(fake.items[0].outcomeStatus).toBe('imported');
        expect(fake.items[0].sessionId).toBe(fake.sessions[0].id);
        const persistedBatch = fake.batches.find((b) => b.id === batch.id)!;
        expect(persistedBatch.status).toBe('committed');
        expect(persistedBatch.imported).toBe(1);
    });

    it('processes multiple items in one batch independently — one failure does not skip the rest', async () => {
        const batch = await createBatch('psy-1', [
            baseItem({ externalEventId: 'evt-a', newClientName: 'Клиент А' }),
            baseItem({ externalEventId: 'evt-b', duration: -1 }), // fails
            baseItem({ externalEventId: 'evt-c', newClientName: 'Клиент C' }),
        ]);
        const result = await commitPracticeImport(batch.id, 'psy-1');

        expect(result.imported).toBe(2);
        expect(result.failed).toBe(1);
        expect(fake.sessions).toHaveLength(2);
    });
});
