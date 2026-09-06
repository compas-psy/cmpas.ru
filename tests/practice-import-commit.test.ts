// Task 12 (PRAKTIKA MVP, founder correction round 3): commitPracticeImport
// and rollbackPracticeImport are the atomic, idempotent, ownership-checked,
// rollback-capable commit core for calendar/spreadsheet import. This
// exercises the real transactional logic (commit.ts) against an in-memory
// fake db — same pattern tests/mobile-idempotency.test.ts uses for
// booking.ts's $transaction + advisory lock (`$transaction: async (fn) =>
// fn(db)`), since real Postgres advisory locks and unique constraints
// aren't available without a live database in this unit-test suite (see
// the separate real-Postgres verification run for this branch).

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Prisma } from '@prisma/client';

interface FakeClient { id: string; psychologistId: string; name: string; status: string }
interface FakeAddress { id: string; psychologistId: string }
interface FakeIntegration { id: string; psychologistId: string; provider: string }
interface FakeSession {
    id: string; psychologistId: string; clientId: string; date: Date; time: string; duration: number;
    status: string; format?: string; addressId?: string | null; origin?: string; notes?: string | null;
    structuredNotes?: unknown; privateNotes?: unknown; notified24h?: boolean; notified1h?: boolean; postSessionNudged?: boolean;
}
interface FakeLink { id: string; psychologistId: string; integrationId: string; sessionId: string; externalEventId: string; externalSeriesId: string | null; sourceRole: string }
interface FakeBatch { id: string; psychologistId: string; sourceType: string; status: string; imported: number; skipped: number; failed: number; updatedAt: Date }
interface FakeItem {
    id: string; batchId: string; integrationId: string | null; provider: string | null;
    externalEventId: string | null; externalSeriesId: string | null; sourceSummary: string | null;
    classification: string; resolution: unknown; startAt: Date | null; endAt: Date | null;
    status: string; errorCode: string | null; createdClientId: string | null; createdSessionId: string | null; calendarSessionLinkId: string | null;
}

function sameUtcDay(a: Date, b: Date) {
    return a.getUTCFullYear() === b.getUTCFullYear() && a.getUTCMonth() === b.getUTCMonth() && a.getUTCDate() === b.getUTCDate();
}

function makeFakeDb() {
    let seq = 0;
    const nextId = (p: string) => `${p}-${++seq}`;

    const clients: FakeClient[] = [];
    const addresses: FakeAddress[] = [];
    const integrations: FakeIntegration[] = [];
    const sessions: FakeSession[] = [];
    const links: FakeLink[] = [];
    const batches: FakeBatch[] = [];
    const items: FakeItem[] = [];
    let attested = true;

    const db: any = {
        $transaction: async (fn: any) => fn(db),
        $executeRaw: async (strings: TemplateStringsArray, ...values: any[]) => {
            const text = strings.join('?');
            if (text.includes("SET status = 'committing'")) {
                const [batchId, psychologistId] = values;
                const batch = batches.find((b) => b.id === batchId && b.psychologistId === psychologistId && (b.status === 'preview' || b.status === 'failed'));
                if (batch) { batch.status = 'committing'; batch.updatedAt = new Date(); return 1; }
                return 0;
            }
            return 0; // advisory lock — no-op in this fake
        },

        practiceOperatorAttestation: { findFirst: async () => (attested ? { id: 'attestation-1' } : null) },
        // commitPracticeImport's post-commit sync-out (item 11) calls the
        // real autoSyncSessionToCalendars, which reads this — returning
        // null here makes it a clean, silent no-op (autoSync disabled),
        // keeping this file focused on the commit core, not the sync adapter
        // (covered separately in calendar-sync-adapter tests).
        psychologistSettings: { findUnique: async () => null },

        diaryClient: {
            findFirst: async ({ where }: any) => clients.find((c) => c.id === where.id && c.psychologistId === where.psychologistId) || null,
            create: async ({ data }: any) => { const c = { id: nextId('client'), status: 'active', ...data }; clients.push(c); return c; },
            deleteMany: async ({ where }: any) => { const n = clients.filter((c) => c.id === where.id).length; for (let i = clients.length - 1; i >= 0; i--) if (clients[i].id === where.id) clients.splice(i, 1); return { count: n }; },
        },
        psychologistAddress: {
            findFirst: async ({ where }: any) => addresses.find((a) => a.id === where.id && a.psychologistId === where.psychologistId) || null,
        },
        calendarIntegration: {
            findFirst: async ({ where }: any) => integrations.find((i) => i.id === where.id && i.psychologistId === where.psychologistId && (!where.provider || i.provider === where.provider)) || null,
        },
        diarySession: {
            findFirst: async ({ where }: any) => sessions.find((s) =>
                s.psychologistId === where.psychologistId && s.clientId === where.clientId
                && s.time === where.time && sameUtcDay(s.date, where.date.gte) && s.status !== 'cancelled',
            ) || null,
            findMany: async ({ where }: any) => sessions.filter((s) =>
                s.psychologistId === where.psychologistId && sameUtcDay(s.date, where.date.gte) && s.status !== 'cancelled',
            ),
            findUnique: async ({ where }: any) => sessions.find((s) => s.id === where.id) || null,
            create: async ({ data }: any) => { const s = { id: nextId('session'), ...data }; sessions.push(s); return s; },
            deleteMany: async ({ where }: any) => { const n = sessions.filter((s) => s.id === where.id).length; for (let i = sessions.length - 1; i >= 0; i--) if (sessions[i].id === where.id) sessions.splice(i, 1); return { count: n }; },
            count: async ({ where }: any) => sessions.filter((s) => s.clientId === where.clientId && (!where.id || s.id !== where.id.not)).length,
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
                if (links.some((l) => l.integrationId === data.integrationId && l.sessionId === data.sessionId)) {
                    throw new Prisma.PrismaClientKnownRequestError('Unique constraint failed', { code: 'P2002', clientVersion: 'test' });
                }
                const l = { id: nextId('link'), ...data }; links.push(l); return l;
            },
            deleteMany: async ({ where }: any) => { for (let i = links.length - 1; i >= 0; i--) if (links[i].id === where.id) links.splice(i, 1); return { count: 1 }; },
        },
        practiceImportBatch: {
            findFirst: async ({ where }: any) => {
                const batch = batches.find((b) => b.id === where.id && b.psychologistId === where.psychologistId);
                if (!batch) return null;
                return { ...batch, items: items.filter((i) => i.batchId === batch.id) };
            },
            create: async ({ data }: any) => {
                const batch: FakeBatch = { id: nextId('batch'), status: 'preview', imported: 0, skipped: 0, failed: 0, updatedAt: new Date(), psychologistId: data.psychologistId, sourceType: data.sourceType };
                batches.push(batch);
                for (const raw of data.items.create) {
                    items.push({
                        id: nextId('item'), batchId: batch.id, status: 'pending', errorCode: null,
                        createdClientId: null, createdSessionId: null, calendarSessionLinkId: null,
                        integrationId: null, provider: null, externalEventId: null, externalSeriesId: null, sourceSummary: null,
                        resolution: null, startAt: null, endAt: null,
                        ...raw,
                    });
                }
                return batch;
            },
            update: async ({ where, data }: any) => { const batch = batches.find((b) => b.id === where.id)!; Object.assign(batch, data); return batch; },
            updateMany: async ({ where, data }: any) => {
                const batch = batches.find((b) => b.id === where.id && b.psychologistId === where.psychologistId);
                if (batch) Object.assign(batch, data);
                return { count: batch ? 1 : 0 };
            },
        },
        practiceImportItem: {
            findMany: async ({ where }: any) => items.filter((i) => (where.batchId ? i.batchId === where.batchId : true) && (!where.id?.in || where.id.in.includes(i.id))),
            update: async ({ where, data }: any) => { const item = items.find((i) => i.id === where.id)!; Object.assign(item, data); return item; },
        },
    };

    return { db, clients, addresses, integrations, sessions, links, batches, items, setAttested: (v: boolean) => { attested = v; } };
}

let fake: ReturnType<typeof makeFakeDb>;
vi.mock('@/lib/db', () => ({ get db() { return fake.db; } }));

const { commitPracticeImport, rollbackPracticeImport, CommitConflictError, RollbackConflictError } = await import('../src/lib/practice/migration/commit');

function baseItem(overrides: Record<string, unknown> = {}) {
    return {
        integrationId: 'integration-1',
        provider: 'google',
        externalEventId: 'evt-1',
        externalSeriesId: null,
        sourceSummary: 'Сессия — Иван Иванов',
        classification: 'session',
        startAt: new Date('2026-09-07T09:00:00.000Z'),
        endAt: new Date('2026-09-07T09:50:00.000Z'),
        resolution: {
            decision: 'session', clientMode: 'new', resolvedClientId: null, newClientName: 'Иван Иванов',
            format: 'online', addressId: null, duration: 50,
        },
        ...overrides,
    };
}

async function createBatch(psychologistId: string, itemsData: ReturnType<typeof baseItem>[], sourceType = 'calendar') {
    return fake.db.practiceImportBatch.create({ data: { psychologistId, sourceType, items: { create: itemsData } } });
}

describe('commitPracticeImport (Task 12 correction round 3)', () => {
    beforeEach(() => {
        fake = makeFakeDb();
        fake.integrations.push({ id: 'integration-1', psychologistId: 'psy-1', provider: 'google' });
    });

    it('imports a new-client session item: creates DiaryClient, DiarySession (status=confirmed), and a CalendarSessionLink', async () => {
        const batch = await createBatch('psy-1', [baseItem()]);
        const result = await commitPracticeImport('psy-1', batch.id);

        expect(result.imported).toBe(1);
        expect(fake.sessions).toHaveLength(1);
        expect(fake.sessions[0]).toMatchObject({ origin: 'calendar_import', status: 'confirmed' });
        expect(fake.sessions[0].notes).toBeNull(); // item 7: never copy the external title into notes
        expect(fake.links).toHaveLength(1);
        expect(fake.links[0]).toMatchObject({ integrationId: 'integration-1', externalEventId: 'evt-1', sourceRole: 'imported', sessionId: fake.sessions[0].id });
    });

    it('clears sourceSummary once an item resolves to imported (item 7)', async () => {
        const batch = await createBatch('psy-1', [baseItem()]);
        await commitPracticeImport('psy-1', batch.id);
        expect(fake.items[0].sourceSummary).toBeNull();
    });

    it('spreadsheet sourceType sets origin=spreadsheet_import instead of calendar_import (item 6)', async () => {
        const batch = await createBatch('psy-1', [baseItem({ integrationId: null, provider: null, externalEventId: null })], 'spreadsheet');
        await commitPracticeImport('psy-1', batch.id);
        expect(fake.sessions[0].origin).toBe('spreadsheet_import');
    });

    it('client_only: creates/matches a client but fabricates no session or date (item 6)', async () => {
        const batch = await createBatch('psy-1', [baseItem({
            classification: 'client_only', integrationId: null, provider: null, externalEventId: null, startAt: null, endAt: null,
            resolution: { decision: 'session', clientMode: 'new', resolvedClientId: null, newClientName: 'Только Имя', format: 'online', addressId: null, duration: 50 },
        })]);
        const result = await commitPracticeImport('psy-1', batch.id);

        expect(result.imported).toBe(1);
        expect(fake.sessions).toHaveLength(0);
        expect(fake.clients).toHaveLength(1);
        expect(fake.items[0].createdClientId).toBe(fake.clients[0].id);
    });

    it('is idempotent: committing the SAME external event via a fresh batch skips it, never creates a second session', async () => {
        const batch1 = await createBatch('psy-1', [baseItem()]);
        await commitPracticeImport('psy-1', batch1.id);
        expect(fake.sessions).toHaveLength(1);

        const batch2 = await createBatch('psy-1', [baseItem({ resolution: { ...baseItem().resolution, newClientName: 'Иван Иванов (повтор)' } })]);
        const result2 = await commitPracticeImport('psy-1', batch2.id);

        expect(result2.imported).toBe(0);
        expect(result2.skipped).toBe(1);
        expect(result2.outcomes[0].errorCode).toBe('ALREADY_IMPORTED');
        expect(fake.sessions).toHaveLength(1);
    });

    it('two items with the SAME externalEventId in ONE batch: the second is skipped, never a raw DB conflict (point 13)', async () => {
        const batch = await createBatch('psy-1', [
            baseItem({ resolution: { ...baseItem().resolution, newClientName: 'Первый' } }),
            baseItem({ resolution: { ...baseItem().resolution, newClientName: 'Второй' } }),
        ]);
        const result = await commitPracticeImport('psy-1', batch.id);

        expect(result.imported).toBe(1);
        expect(result.skipped).toBe(1);
        expect(result.outcomes[1].errorCode).toBe('ALREADY_IMPORTED');
        expect(fake.sessions).toHaveLength(1);
    });

    it('re-committing the SAME already-committed batch returns the persisted result verbatim — never re-derives ALREADY_IMPORTED', async () => {
        const batch = await createBatch('psy-1', [baseItem()]);
        const first = await commitPracticeImport('psy-1', batch.id);
        const second = await commitPracticeImport('psy-1', batch.id);

        expect(second).toEqual(first);
        expect(second.outcomes[0].status).toBe('imported'); // NOT flipped to skipped/ALREADY_IMPORTED
        expect(fake.sessions).toHaveLength(1);
    });

    it('a commit already IN PROGRESS (status=committing) throws CommitConflictError, never reprocesses', async () => {
        const batch = await createBatch('psy-1', [baseItem()]);
        // Simulate request A mid-flight: claimed the batch but hasn't finished.
        fake.batches.find((b) => b.id === batch.id)!.status = 'committing';

        await expect(commitPracticeImport('psy-1', batch.id)).rejects.toThrow(CommitConflictError);
        expect(fake.sessions).toHaveLength(0);
        expect(fake.items[0].status).toBe('pending'); // untouched
    });

    it('rejects a resolvedClientId that does not belong to this psychologist — item errors, no session created', async () => {
        fake.clients.push({ id: 'client-other', psychologistId: 'psy-OTHER', name: 'Кто-то', status: 'active' });
        const batch = await createBatch('psy-1', [baseItem({ resolution: { decision: 'session', clientMode: 'existing', resolvedClientId: 'client-other', newClientName: null, format: 'online', addressId: null, duration: 50 } })]);
        const result = await commitPracticeImport('psy-1', batch.id);

        expect(result.failed).toBe(1);
        expect(result.outcomes[0].errorCode).toBe('CLIENT_NOT_OWNED');
        expect(fake.sessions).toHaveLength(0);
    });

    it('rejects a foreign/unowned integrationId — INTEGRATION_NOT_OWNED, never trusts the FK alone', async () => {
        const batch = await createBatch('psy-1', [baseItem({ integrationId: 'someone-elses-integration' })]);
        const result = await commitPracticeImport('psy-1', batch.id);

        expect(result.failed).toBe(1);
        expect(result.outcomes[0].errorCode).toBe('INTEGRATION_NOT_OWNED');
        expect(fake.sessions).toHaveLength(0);
        expect(fake.clients).toHaveLength(0); // point 9: no client created before this check
    });

    it('rejects an offline item with no addressId — ADDRESS_REQUIRED, no client created first (point 9)', async () => {
        const batch = await createBatch('psy-1', [baseItem({ resolution: { ...baseItem().resolution, format: 'offline', addressId: null } })]);
        const result = await commitPracticeImport('psy-1', batch.id);

        expect(result.failed).toBe(1);
        expect(result.outcomes[0].errorCode).toBe('ADDRESS_REQUIRED');
        expect(fake.clients).toHaveLength(0);
    });

    it('rejects a foreign/unowned addressId — ADDRESS_NOT_OWNED, no client created first', async () => {
        const batch = await createBatch('psy-1', [baseItem({ resolution: { ...baseItem().resolution, format: 'offline', addressId: 'someone-elses-address' } })]);
        const result = await commitPracticeImport('psy-1', batch.id);

        expect(result.failed).toBe(1);
        expect(result.outcomes[0].errorCode).toBe('ADDRESS_NOT_OWNED');
        expect(fake.clients).toHaveLength(0);
    });

    it('imports an offline item with an owned addressId', async () => {
        fake.addresses.push({ id: 'addr-1', psychologistId: 'psy-1' });
        const batch = await createBatch('psy-1', [baseItem({ resolution: { ...baseItem().resolution, format: 'offline', addressId: 'addr-1' } })]);
        const result = await commitPracticeImport('psy-1', batch.id);

        expect(result.imported).toBe(1);
        expect(fake.sessions[0]).toMatchObject({ format: 'offline', addressId: 'addr-1' });
    });

    it('rejects ambiguous client resolution (both resolvedClientId and newClientName)', async () => {
        const batch = await createBatch('psy-1', [baseItem({ resolution: { decision: 'session', clientMode: 'existing', resolvedClientId: 'client-x', newClientName: 'Иван', format: 'online', addressId: null, duration: 50 } })]);
        const result = await commitPracticeImport('psy-1', batch.id);
        expect(result.outcomes[0].errorCode).toBe('AMBIGUOUS_CLIENT_RESOLUTION');
    });

    it('rejects a non-finite or non-positive duration', async () => {
        const batch = await createBatch('psy-1', [baseItem({ resolution: { ...baseItem().resolution, duration: 0 } })]);
        const result = await commitPracticeImport('psy-1', batch.id);
        expect(result.outcomes[0].errorCode).toBe('INVALID_DURATION');
    });

    it('flags a genuine time overlap against an EXISTING session as SESSION_CONFLICT (error), not a silent skip (item 8)', async () => {
        fake.clients.push({ id: 'client-existing', psychologistId: 'psy-1', name: 'Existing', status: 'active' });
        fake.sessions.push({ id: 'session-existing', psychologistId: 'psy-1', clientId: 'client-existing', date: new Date('2026-09-07T00:00:00.000Z'), time: '09:20', duration: 30, status: 'confirmed' });

        const batch = await createBatch('psy-1', [baseItem()]); // 09:00-09:50, overlaps 09:20-09:50
        const result = await commitPracticeImport('psy-1', batch.id);

        expect(result.failed).toBe(1);
        expect(result.outcomes[0].errorCode).toBe('SESSION_CONFLICT');
        expect(fake.sessions).toHaveLength(1); // only the pre-existing one
    });

    it('flags a time overlap between two items being created in the SAME batch as SESSION_CONFLICT', async () => {
        const batch = await createBatch('psy-1', [
            baseItem({ externalEventId: 'evt-a', resolution: { ...baseItem().resolution, newClientName: 'Клиент А' } }),
            baseItem({ externalEventId: 'evt-b', startAt: new Date('2026-09-07T09:20:00.000Z'), endAt: new Date('2026-09-07T09:40:00.000Z'), resolution: { ...baseItem().resolution, newClientName: 'Клиент Б' } }),
        ]);
        const result = await commitPracticeImport('psy-1', batch.id);

        expect(result.imported).toBe(1);
        expect(result.failed).toBe(1);
        expect(result.outcomes[1].errorCode).toBe('SESSION_CONFLICT');
    });

    it('a non-overlapping session on the same day is unaffected', async () => {
        fake.clients.push({ id: 'client-existing', psychologistId: 'psy-1', name: 'Existing', status: 'active' });
        fake.sessions.push({ id: 'session-existing', psychologistId: 'psy-1', clientId: 'client-existing', date: new Date('2026-09-07T00:00:00.000Z'), time: '11:00', duration: 30, status: 'confirmed' });

        const batch = await createBatch('psy-1', [baseItem()]); // 09:00-09:50, no overlap with 11:00
        const result = await commitPracticeImport('psy-1', batch.id);
        expect(result.imported).toBe(1);
    });

    it('writes the per-item outcome back onto the item row — the durable evidence', async () => {
        const batch = await createBatch('psy-1', [baseItem()]);
        await commitPracticeImport('psy-1', batch.id);

        expect(fake.items[0].status).toBe('imported');
        expect(fake.items[0].createdSessionId).toBe(fake.sessions[0].id);
        expect(fake.items[0].calendarSessionLinkId).toBe(fake.links[0].id);
        const persistedBatch = fake.batches.find((b) => b.id === batch.id)!;
        expect(persistedBatch.status).toBe('committed');
        expect(persistedBatch.imported).toBe(1);
    });

    it('a genuine DB error rolls back the whole transaction and marks the batch failed (not stuck at committing) — retryable', async () => {
        const batch = await createBatch('psy-1', [baseItem()]);
        const originalCreate = fake.db.diarySession.create;
        fake.db.diarySession.create = async () => { throw new Error('connection reset'); };

        await expect(commitPracticeImport('psy-1', batch.id)).rejects.toThrow('connection reset');
        expect(fake.batches.find((b) => b.id === batch.id)!.status).toBe('failed');
        expect(fake.sessions).toHaveLength(0); // rolled back
        expect(fake.items[0].status).toBe('pending'); // outcome write rolled back too — never persisted as failed

        fake.db.diarySession.create = originalCreate;
        const retry = await commitPracticeImport('psy-1', batch.id);
        expect(retry.imported).toBe(1);
    });

    it('operator attestation is required — checked by the domain function itself, not just the HTTP route', async () => {
        fake.setAttested(false);
        const batch = await createBatch('psy-1', [baseItem()]);
        await expect(commitPracticeImport('psy-1', batch.id)).rejects.toThrow();
        expect(fake.sessions).toHaveLength(0);
    });
});

describe('rollbackPracticeImport (Task 12 correction round 3)', () => {
    beforeEach(() => {
        fake = makeFakeDb();
        fake.integrations.push({ id: 'integration-1', psychologistId: 'psy-1', provider: 'google' });
    });

    it('deletes the created session and link, and the client it created (clientMode=new)', async () => {
        const batch = await createBatch('psy-1', [baseItem()]);
        await commitPracticeImport('psy-1', batch.id);
        expect(fake.sessions).toHaveLength(1);

        const result = await rollbackPracticeImport('psy-1', batch.id);

        expect(result.outcomes[0].status).toBe('rolled_back');
        expect(fake.sessions).toHaveLength(0);
        expect(fake.links).toHaveLength(0);
        expect(fake.clients).toHaveLength(0);
        expect(fake.batches.find((b) => b.id === batch.id)!.status).toBe('rolled_back');
    });

    it('NEVER deletes a matched pre-existing client (clientMode=existing)', async () => {
        fake.clients.push({ id: 'client-1', psychologistId: 'psy-1', name: 'Иван Иванов', status: 'active' });
        const batch = await createBatch('psy-1', [baseItem({ resolution: { decision: 'session', clientMode: 'existing', resolvedClientId: 'client-1', newClientName: null, format: 'online', addressId: null, duration: 50 } })]);
        await commitPracticeImport('psy-1', batch.id);

        await rollbackPracticeImport('psy-1', batch.id);

        expect(fake.clients).toHaveLength(1); // still there
        expect(fake.sessions).toHaveLength(0); // session itself still removed
    });

    it('refuses to roll back a session that was modified since import (status changed) — reports a conflict, does not delete', async () => {
        const batch = await createBatch('psy-1', [baseItem()]);
        await commitPracticeImport('psy-1', batch.id);
        fake.sessions[0].status = 'completed'; // psychologist marked it done

        const result = await rollbackPracticeImport('psy-1', batch.id);

        expect(result.outcomes[0]).toMatchObject({ status: 'conflict', reason: 'SESSION_MODIFIED_SINCE_IMPORT' });
        expect(fake.sessions).toHaveLength(1); // NOT deleted
        expect(fake.batches.find((b) => b.id === batch.id)!.status).toBe('committed'); // not claimed rolled_back
    });

    it('refuses to roll back a created client that has other sessions beyond the one this batch created', async () => {
        const batch = await createBatch('psy-1', [baseItem()]);
        await commitPracticeImport('psy-1', batch.id);
        const clientId = fake.clients[0].id;
        fake.sessions.push({ id: 'session-extra', psychologistId: 'psy-1', clientId, date: new Date('2026-09-10T00:00:00.000Z'), time: '10:00', duration: 50, status: 'confirmed' });

        const result = await rollbackPracticeImport('psy-1', batch.id);

        expect(result.outcomes[0]).toMatchObject({ status: 'conflict', reason: 'CLIENT_HAS_OTHER_SESSIONS' });
        expect(fake.clients).toHaveLength(1); // not deleted
    });

    it('ownership: psychologist B cannot roll back a batch owned by psychologist A', async () => {
        fake.integrations.push({ id: 'integration-A', psychologistId: 'psy-A', provider: 'google' });
        const batch = await createBatch('psy-A', [baseItem({ integrationId: 'integration-A' })]);
        await commitPracticeImport('psy-A', batch.id);

        await expect(rollbackPracticeImport('psy-B', batch.id)).rejects.toThrow();
        expect(fake.sessions).toHaveLength(1); // untouched
    });

    it('refuses to roll back a batch that was never committed', async () => {
        const batch = await createBatch('psy-1', [baseItem()]);
        await expect(rollbackPracticeImport('psy-1', batch.id)).rejects.toThrow(RollbackConflictError);
    });
});
