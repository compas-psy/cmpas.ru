import { describe, it, expect } from 'vitest';
import { recordSubscriptionPayment } from '@/lib/analytics/subscription';

type Db = Parameters<typeof recordSubscriptionPayment>[0];
interface UpsertCall { create: Record<string, unknown>; update: Record<string, unknown> }

function makeDb(existing: { currentPeriodEnd: Date } | null = null) {
    const upsertCalls: UpsertCall[] = [];
    const db = {
        subscription: {
            findUnique: (async () => existing) as Db['subscription']['findUnique'],
            upsert: (async (args: UpsertCall) => { upsertCalls.push(args); return args; }) as Db['subscription']['upsert'],
        },
    } as Db;
    return { db, upsertCalls };
}

describe('recordSubscriptionPayment (charter/13_TRACKING_PLAN.md §5)', () => {
    it('creates a new active subscription starting from now for a first payment', async () => {
        const { db, upsertCalls } = makeDb(null);
        const now = new Date('2026-08-17T00:00:00Z');
        await recordSubscriptionPayment(db, { userId: 'u1', plan: 'practice', months: 1, terminal: 'site' }, now);

        const create = upsertCalls[0].create;
        expect(create.status).toBe('active');
        expect(create.startedAt).toEqual(now);
        expect(create.currentPeriodEnd).toEqual(new Date('2026-09-17T00:00:00Z'));
    });

    it('extends from the existing currentPeriodEnd when it is still in the future', async () => {
        const existing = { currentPeriodEnd: new Date('2026-09-01T00:00:00Z') };
        const { db, upsertCalls } = makeDb(existing);
        const now = new Date('2026-08-17T00:00:00Z');
        await recordSubscriptionPayment(db, { userId: 'u1', plan: 'practice', months: 1, terminal: 'site' }, now);

        expect(upsertCalls[0].update.currentPeriodEnd).toEqual(new Date('2026-10-01T00:00:00Z'));
    });

    it('restarts from now when the existing period already expired', async () => {
        const existing = { currentPeriodEnd: new Date('2026-01-01T00:00:00Z') };
        const { db, upsertCalls } = makeDb(existing);
        const now = new Date('2026-08-17T00:00:00Z');
        await recordSubscriptionPayment(db, { userId: 'u1', plan: 'practice', months: 2, terminal: 'app' }, now);

        expect(upsertCalls[0].update.currentPeriodEnd).toEqual(new Date('2026-10-17T00:00:00Z'));
        expect(upsertCalls[0].update.terminal).toBe('app');
    });
});
