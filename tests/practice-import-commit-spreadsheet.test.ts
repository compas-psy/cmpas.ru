// Task 13: spreadsheet/paste-specific commit behavior layered on Task 12's
// commit core — sourceFingerprint idempotency (in-batch + cross-batch,
// re-import after rollback), the same-batch running-new-client dedup by
// strong identity (§12), and phone/email persisted on a newly created client.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Prisma } from '@prisma/client';

interface FakeClient { id: string; psychologistId: string; name: string; phone?: string | null; email?: string | null; status: string }
interface FakeAddress { id: string; psychologistId: string }
interface FakeSession { id: string; psychologistId: string; clientId: string; date: Date; time: string; duration: number; status: string; format?: string; addressId?: string | null; origin?: string; notes?: string | null }
interface FakeBatch { id: string; psychologistId: string; sourceType: string; status: string; imported: number; skipped: number; failed: number; updatedAt: Date }
interface FakeItem {
    id: string; batchId: string; integrationId: string | null; provider: string | null;
    externalEventId: string | null; externalSeriesId: string | null; sourceSummary: string | null;
    classification: string; resolution: unknown; startAt: Date | null; endAt: Date | null; sourceFingerprint: string | null;
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
    const sessions: FakeSession[] = [];
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
            return 0;
        },
        practiceOperatorAttestation: { findFirst: async () => (attested ? { id: 'attestation-1' } : null) },
        psychologistSettings: { findUnique: async () => null },
        diaryClient: {
            findFirst: async ({ where }: any) => clients.find((c) => c.id === where.id && c.psychologistId === where.psychologistId) || null,
            create: async ({ data }: any) => { const c = { id: nextId('client'), status: 'active', ...data }; clients.push(c); return c; },
            deleteMany: async ({ where }: any) => { const n = clients.filter((c) => c.id === where.id).length; for (let i = clients.length - 1; i >= 0; i--) if (clients[i].id === where.id) clients.splice(i, 1); return { count: n }; },
        },
        psychologistAddress: {
            findFirst: async ({ where }: any) => addresses.find((a) => a.id === where.id && a.psychologistId === where.psychologistId) || null,
        },
        calendarIntegration: { findFirst: async () => null },
        diarySession: {
            findMany: async ({ where }: any) => sessions.filter((s) =>
                s.psychologistId === where.psychologistId && sameUtcDay(s.date, where.date.gte) && s.status !== 'cancelled',
            ),
            findUnique: async ({ where }: any) => sessions.find((s) => s.id === where.id) || null,
            create: async ({ data }: any) => { const s = { id: nextId('session'), ...data }; sessions.push(s); return s; },
            deleteMany: async ({ where }: any) => { const n = sessions.filter((s) => s.id === where.id).length; for (let i = sessions.length - 1; i >= 0; i--) if (sessions[i].id === where.id) sessions.splice(i, 1); return { count: n }; },
            count: async () => 0,
        },
        calendarSessionLink: {
            findUnique: async () => null,
            create: async ({ data }: any) => { throw new Error('spreadsheet items must never create a CalendarSessionLink: ' + JSON.stringify(data)); },
            deleteMany: async () => ({ count: 0 }),
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
                        resolution: null, startAt: null, endAt: null, sourceFingerprint: null,
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
            findFirst: async ({ where }: any) => {
                const match = items.find((i) => {
                    if (where.sourceFingerprint !== undefined && i.sourceFingerprint !== where.sourceFingerprint) return false;
                    if (where.status !== undefined && i.status !== where.status) return false;
                    if (where.id?.not !== undefined && i.id === where.id.not) return false;
                    if (where.batch) {
                        const batch = batches.find((b) => b.id === i.batchId);
                        if (!batch) return false;
                        if (where.batch.psychologistId !== undefined && batch.psychologistId !== where.batch.psychologistId) return false;
                        if (where.batch.sourceType !== undefined && batch.sourceType !== where.batch.sourceType) return false;
                    }
                    return true;
                });
                return match || null;
            },
            findMany: async ({ where }: any) => items.filter((i) => (where.batchId ? i.batchId === where.batchId : true) && (!where.id?.in || where.id.in.includes(i.id))),
            update: async ({ where, data }: any) => { const item = items.find((i) => i.id === where.id)!; Object.assign(item, data); return item; },
        },
    };

    return { db, clients, addresses, sessions, batches, items, setAttested: (v: boolean) => { attested = v; } };
}

let fake: ReturnType<typeof makeFakeDb>;
vi.mock('@/lib/db', () => ({ get db() { return fake.db; } }));

const { commitPracticeImport, rollbackPracticeImport } = await import('../src/lib/practice/migration/commit');

function sessionItem(overrides: Record<string, unknown> = {}) {
    return {
        classification: 'session',
        startAt: new Date('2026-09-12T15:00:00.000Z'),
        endAt: new Date('2026-09-12T15:50:00.000Z'),
        resolution: {
            decision: 'session', clientMode: 'new', resolvedClientId: null, newClientName: 'Анна Иванова',
            newClientPhone: '+79161234567', newClientEmail: null, format: 'online', addressId: null, duration: 50,
        },
        sourceFingerprint: 'fp-fixed-1',
        ...overrides,
    };
}

async function createBatch(psychologistId: string, itemsData: Record<string, unknown>[]) {
    return fake.db.practiceImportBatch.create({ data: { psychologistId, sourceType: 'spreadsheet', items: { create: itemsData } } });
}

describe('commitPracticeImport — Task 13 spreadsheet fingerprint idempotency', () => {
    beforeEach(() => { fake = makeFakeDb(); });

    it('the same fingerprint twice in ONE batch: the second is skipped as DUPLICATE_SOURCE_ROW, no second session', async () => {
        const batch = await createBatch('psy-1', [sessionItem(), sessionItem({ startAt: new Date('2026-09-12T16:00:00.000Z'), endAt: new Date('2026-09-12T16:50:00.000Z') })]);
        const result = await commitPracticeImport('psy-1', batch.id);

        expect(result.imported).toBe(1);
        expect(result.skipped).toBe(1);
        expect(fake.sessions).toHaveLength(1);
        expect(fake.items[1]).toMatchObject({ status: 'skipped', errorCode: 'DUPLICATE_SOURCE_ROW' });
    });

    it('re-uploading the same spreadsheet in a SECOND batch is ALREADY_IMPORTED_SOURCE_ROW, never a second session', async () => {
        const batch1 = await createBatch('psy-1', [sessionItem()]);
        await commitPracticeImport('psy-1', batch1.id);
        expect(fake.sessions).toHaveLength(1);

        const batch2 = await createBatch('psy-1', [sessionItem({ startAt: new Date('2026-09-12T17:00:00.000Z'), endAt: new Date('2026-09-12T17:50:00.000Z') })]);
        const result2 = await commitPracticeImport('psy-1', batch2.id);

        expect(result2.imported).toBe(0);
        expect(result2.skipped).toBe(1);
        expect(fake.sessions).toHaveLength(1); // still just one — the reschedule-then-reupload scenario from §13
        expect(fake.items.find((i) => i.batchId === batch2.id)).toMatchObject({ status: 'skipped', errorCode: 'ALREADY_IMPORTED_SOURCE_ROW' });
    });

    it('after a genuine rollback, the same fingerprint becomes eligible for re-import again', async () => {
        const batch1 = await createBatch('psy-1', [sessionItem()]);
        await commitPracticeImport('psy-1', batch1.id);
        await rollbackPracticeImport('psy-1', batch1.id);
        expect(fake.sessions).toHaveLength(0);

        const batch2 = await createBatch('psy-1', [sessionItem()]);
        const result2 = await commitPracticeImport('psy-1', batch2.id);

        expect(result2.imported).toBe(1);
        expect(fake.sessions).toHaveLength(1);
    });

    it('a genuine schedule conflict is distinct from a duplicate — two different new clients overlapping the same slot', async () => {
        const batch = await createBatch('psy-1', [
            sessionItem({ sourceFingerprint: 'fp-a' }),
            sessionItem({
                sourceFingerprint: 'fp-b',
                resolution: { decision: 'session', clientMode: 'new', resolvedClientId: null, newClientName: 'Другой Клиент', newClientPhone: '+79000000009', newClientEmail: null, format: 'online', addressId: null, duration: 50 },
            }),
        ]);
        const result = await commitPracticeImport('psy-1', batch.id);
        expect(result.imported).toBe(1);
        expect(result.failed).toBe(1);
        expect(fake.items[1]).toMatchObject({ status: 'error', errorCode: 'SESSION_CONFLICT' });
    });
});

describe('commitPracticeImport — Task 13 same-batch new-client dedup by strong identity (§12)', () => {
    beforeEach(() => { fake = makeFakeDb(); });

    it('two session rows sharing a phone in one batch create exactly ONE client — only the first row claims createdClientId', async () => {
        const batch = await createBatch('psy-1', [
            sessionItem({ sourceFingerprint: 'fp-a' }),
            sessionItem({
                sourceFingerprint: 'fp-b',
                startAt: new Date('2026-09-13T15:00:00.000Z'), endAt: new Date('2026-09-13T15:50:00.000Z'),
                resolution: { decision: 'session', clientMode: 'new', resolvedClientId: null, newClientName: 'Анна Иванова', newClientPhone: '89161234567', newClientEmail: null, format: 'online', addressId: null, duration: 50 },
            }),
        ]);
        const result = await commitPracticeImport('psy-1', batch.id);

        expect(result.imported).toBe(2);
        expect(fake.clients).toHaveLength(1);
        expect(fake.sessions).toHaveLength(2);
        expect(fake.sessions[0].clientId).toBe(fake.clients[0].id);
        expect(fake.sessions[1].clientId).toBe(fake.clients[0].id);
        expect(fake.items[0].createdClientId).toBe(fake.clients[0].id);
        expect(fake.items[1].createdClientId).toBeNull(); // reused, did not create
    });

    it('persists newClientPhone/newClientEmail on the created client', async () => {
        const batch = await createBatch('psy-1', [sessionItem({
            resolution: { decision: 'session', clientMode: 'new', resolvedClientId: null, newClientName: 'Анна Иванова', newClientPhone: '+79161234567', newClientEmail: 'anna@example.com', format: 'online', addressId: null, duration: 50 },
        })]);
        await commitPracticeImport('psy-1', batch.id);
        expect(fake.clients[0]).toMatchObject({ phone: '+79161234567', email: 'anna@example.com' });
    });
});

describe('commitPracticeImport — Task 13 offline/address ownership for spreadsheet rows', () => {
    beforeEach(() => { fake = makeFakeDb(); fake.addresses.push({ id: 'addr-owned', psychologistId: 'psy-1' }); });

    it('an owned cabinet imports successfully', async () => {
        const batch = await createBatch('psy-1', [sessionItem({ resolution: { ...sessionItem().resolution, format: 'offline', addressId: 'addr-owned' } })]);
        const result = await commitPracticeImport('psy-1', batch.id);
        expect(result.imported).toBe(1);
        expect(fake.sessions[0].addressId).toBe('addr-owned');
    });

    it('a foreign/non-owned addressId is rejected — never trust the client-submitted id', async () => {
        const batch = await createBatch('psy-1', [sessionItem({ resolution: { ...sessionItem().resolution, format: 'offline', addressId: 'addr-someone-elses' } })]);
        const result = await commitPracticeImport('psy-1', batch.id);
        expect(result.failed).toBe(1);
        expect(fake.items[0]).toMatchObject({ status: 'error', errorCode: 'ADDRESS_NOT_OWNED' });
        expect(fake.sessions).toHaveLength(0);
    });
});

describe('commitPracticeImport — Task 13 client_only mode via spreadsheet/paste', () => {
    beforeEach(() => { fake = makeFakeDb(); });

    it('client_only rows never create a session, and never a CalendarSessionLink', async () => {
        const batch = await createBatch('psy-1', [{
            classification: 'client_only', startAt: null, endAt: null, sourceFingerprint: null,
            resolution: { decision: 'session', clientMode: 'new', resolvedClientId: null, newClientName: 'Только Имя', newClientPhone: '+79165550001', newClientEmail: null, format: 'online', addressId: null, duration: 50 },
        }]);
        const result = await commitPracticeImport('psy-1', batch.id);
        expect(result.imported).toBe(1);
        expect(fake.sessions).toHaveLength(0);
        expect(fake.clients[0]).toMatchObject({ name: 'Только Имя', phone: '+79165550001' });
    });
});
