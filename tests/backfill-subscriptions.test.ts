// B2: обратное заполнение Subscription из Payment/User (charter/13_TRACKING_PLAN.md §5).
// computeSubscriptionBackfill — чистая функция плана, applyBackfill — её
// исполнение поверх мока db.

import { describe, it, expect, vi } from 'vitest';
import {
    computeSubscriptionBackfill,
    applyBackfill,
    type BackfillUser,
    type BackfillPayment,
    type ExistingSubscription,
} from '@/lib/analytics/backfill-subscriptions';

const NOW = new Date('2026-08-23T00:00:00Z');

describe('computeSubscriptionBackfill', () => {
    it('пустая база (нет User с подпиской, нет оплаченных Payment) — план пуст', () => {
        const plan = computeSubscriptionBackfill([], [], [], NOW);
        expect(plan).toEqual([]);
    });

    it('создаёт строку для пользователя с subscriptionEndsAt в будущем — status active', () => {
        const users: BackfillUser[] = [
            { id: 'u1', subscriptionEndsAt: new Date('2026-09-23T00:00:00Z'), subscriptionPlan: 'practice' },
        ];
        const payments: BackfillPayment[] = [
            { userId: 'u1', status: 'paid', plan: 'practice', terminal: 'site', createdAt: new Date('2026-07-23T00:00:00Z') },
        ];
        const plan = computeSubscriptionBackfill(users, payments, [], NOW);

        expect(plan).toHaveLength(1);
        expect(plan[0].action).toBe('create');
        expect(plan[0].target).toMatchObject({
            userId: 'u1',
            plan: 'practice',
            status: 'active',
            terminal: 'site',
            startedAt: new Date('2026-07-23T00:00:00Z'),
            currentPeriodEnd: new Date('2026-09-23T00:00:00Z'),
        });
    });

    it('subscriptionEndsAt в прошлом — status churned', () => {
        const users: BackfillUser[] = [
            { id: 'u1', subscriptionEndsAt: new Date('2026-01-01T00:00:00Z'), subscriptionPlan: 'practice' },
        ];
        const plan = computeSubscriptionBackfill(users, [], [], NOW);
        expect(plan[0].action).toBe('create');
        expect(plan[0].target?.status).toBe('churned');
    });

    it('несколько оплаченных платежей — terminal и startedAt берутся из последнего/первого по времени, а не по порядку в массиве', () => {
        const users: BackfillUser[] = [
            { id: 'u1', subscriptionEndsAt: new Date('2026-10-01T00:00:00Z'), subscriptionPlan: 'practice_plus' },
        ];
        const payments: BackfillPayment[] = [
            { userId: 'u1', status: 'paid', plan: 'practice', terminal: 'app', createdAt: new Date('2026-08-01T00:00:00Z') },
            { userId: 'u1', status: 'paid', plan: 'practice_plus', terminal: 'site', createdAt: new Date('2026-06-01T00:00:00Z') },
            { userId: 'u1', status: 'failed', plan: 'practice_plus', terminal: 'site', createdAt: new Date('2026-08-15T00:00:00Z') },
        ];
        const plan = computeSubscriptionBackfill(users, payments, [], NOW);
        expect(plan[0].target).toMatchObject({
            terminal: 'app', // последний ОПЛАЧЕННЫЙ (2026-08-01), failed от 08-15 не считается
            startedAt: new Date('2026-06-01T00:00:00Z'), // первый оплаченный
        });
    });

    it('нет subscriptionEndsAt, но есть оплаченный платёж (User сброшен, история осталась) — восстанавливает из Payment', () => {
        const users: BackfillUser[] = [{ id: 'u1', subscriptionEndsAt: null, subscriptionPlan: null }];
        const payments: BackfillPayment[] = [
            { userId: 'u1', status: 'paid', plan: 'practice', terminal: 'site', createdAt: new Date('2026-07-01T00:00:00Z') },
        ];
        const plan = computeSubscriptionBackfill(users, payments, [], NOW);
        expect(plan[0].action).toBe('create');
        expect(plan[0].target?.plan).toBe('practice');
        expect(plan[0].target?.currentPeriodEnd).toEqual(new Date('2026-07-01T00:00:00Z'));
    });

    it('нет ни subscriptionEndsAt, ни оплаченных платежей (только pending/failed) — пропускается с причиной, а не создаётся пустышкой', () => {
        const users: BackfillUser[] = [{ id: 'u1', subscriptionEndsAt: null, subscriptionPlan: null }];
        const payments: BackfillPayment[] = [
            { userId: 'u1', status: 'pending', plan: 'practice', terminal: 'site', createdAt: new Date('2026-07-01T00:00:00Z') },
            { userId: 'u1', status: 'failed', plan: 'practice', terminal: 'site', createdAt: new Date('2026-07-02T00:00:00Z') },
        ];
        const plan = computeSubscriptionBackfill(users, payments, [], NOW);
        expect(plan).toHaveLength(0);
    });

    it('план неизвестен (subscriptionPlan нет и оплаченных платежей нет, хотя subscriptionEndsAt задан) — skip с причиной', () => {
        const users: BackfillUser[] = [
            { id: 'u1', subscriptionEndsAt: new Date('2026-09-01T00:00:00Z'), subscriptionPlan: null },
        ];
        const plan = computeSubscriptionBackfill(users, [], [], NOW);
        expect(plan).toHaveLength(1);
        expect(plan[0].action).toBe('skip');
        expect(plan[0].target).toBeUndefined();
        expect(plan[0].reason).toMatch(/план/);
    });

    it('существующая строка уже верна — skip, не update (не трогаем updatedAt)', () => {
        const users: BackfillUser[] = [
            { id: 'u1', subscriptionEndsAt: new Date('2026-09-23T00:00:00Z'), subscriptionPlan: 'practice' },
        ];
        const payments: BackfillPayment[] = [
            { userId: 'u1', status: 'paid', plan: 'practice', terminal: 'site', createdAt: new Date('2026-07-23T00:00:00Z') },
        ];
        const existing: ExistingSubscription[] = [
            {
                userId: 'u1',
                plan: 'practice',
                status: 'active',
                terminal: 'site',
                startedAt: new Date('2026-07-23T00:00:00Z'),
                currentPeriodEnd: new Date('2026-09-23T00:00:00Z'),
            },
        ];
        const plan = computeSubscriptionBackfill(users, payments, existing, NOW);
        expect(plan).toHaveLength(1);
        expect(plan[0].action).toBe('skip');
    });

    it('существующая строка расходится с User/Payment (например, status устарел) — update', () => {
        const users: BackfillUser[] = [
            { id: 'u1', subscriptionEndsAt: new Date('2026-01-01T00:00:00Z'), subscriptionPlan: 'practice' },
        ];
        const existing: ExistingSubscription[] = [
            {
                userId: 'u1',
                plan: 'practice',
                status: 'active', // устарело — подписка уже кончилась
                terminal: 'site',
                startedAt: new Date('2025-12-01T00:00:00Z'),
                currentPeriodEnd: new Date('2026-01-01T00:00:00Z'),
            },
        ];
        const plan = computeSubscriptionBackfill(users, [], existing, NOW);
        expect(plan).toHaveLength(1);
        expect(plan[0].action).toBe('update');
        expect(plan[0].target?.status).toBe('churned');
    });

    it('частично заполненная таблица: один верный (skip), один отсутствует (create), один расходится (update) — все три в одном плане', () => {
        const users: BackfillUser[] = [
            { id: 'correct', subscriptionEndsAt: new Date('2026-09-01T00:00:00Z'), subscriptionPlan: 'practice' },
            { id: 'missing', subscriptionEndsAt: new Date('2026-09-01T00:00:00Z'), subscriptionPlan: 'practice_plus' },
            { id: 'stale', subscriptionEndsAt: new Date('2026-09-01T00:00:00Z'), subscriptionPlan: 'practice' },
        ];
        const existing: ExistingSubscription[] = [
            {
                userId: 'correct',
                plan: 'practice',
                status: 'active',
                terminal: 'site',
                startedAt: new Date('2026-09-01T00:00:00Z'),
                currentPeriodEnd: new Date('2026-09-01T00:00:00Z'),
            },
            {
                userId: 'stale',
                plan: 'practice',
                status: 'churned', // расходится с реальным active
                terminal: 'site',
                startedAt: new Date('2026-09-01T00:00:00Z'),
                currentPeriodEnd: new Date('2026-09-01T00:00:00Z'),
            },
        ];
        const plan = computeSubscriptionBackfill(users, [], existing, NOW);
        const byUser = Object.fromEntries(plan.map((p) => [p.userId, p.action]));
        expect(byUser).toEqual({ correct: 'skip', missing: 'create', stale: 'update' });
    });

    it('два прогона подряд на одном и том же исходном срезе дают одинаковый results (второй прогон — всё skip)', () => {
        const users: BackfillUser[] = [
            { id: 'u1', subscriptionEndsAt: new Date('2026-09-23T00:00:00Z'), subscriptionPlan: 'practice' },
            { id: 'u2', subscriptionEndsAt: new Date('2026-01-01T00:00:00Z'), subscriptionPlan: 'practice_plus' },
        ];
        const payments: BackfillPayment[] = [
            { userId: 'u1', status: 'paid', plan: 'practice', terminal: 'site', createdAt: new Date('2026-07-23T00:00:00Z') },
        ];

        const firstRun = computeSubscriptionBackfill(users, payments, [], NOW);
        expect(firstRun.every((p) => p.action === 'create')).toBe(true);

        // Материализуем результат первого прогона как "уже в базе" и считаем план снова.
        const existingAfterFirstRun: ExistingSubscription[] = firstRun.map((p) => ({ ...p.target! }));
        const secondRun = computeSubscriptionBackfill(users, payments, existingAfterFirstRun, NOW);

        expect(secondRun.every((p) => p.action === 'skip')).toBe(true);
        expect(secondRun.map((p) => p.userId).sort()).toEqual(firstRun.map((p) => p.userId).sort());
    });
});

describe('applyBackfill', () => {
    it('вызывает create только для create, update только для update, ничего не пишет для skip', async () => {
        const create = vi.fn(async () => ({}));
        const update = vi.fn(async () => ({}));
        const db = { subscription: { create, update } };

        const target = {
            userId: 'u1',
            plan: 'practice',
            status: 'active' as const,
            terminal: 'site',
            startedAt: new Date('2026-07-01T00:00:00Z'),
            currentPeriodEnd: new Date('2026-09-01T00:00:00Z'),
        };

        const result = await applyBackfill(db, [
            { userId: 'u1', action: 'create', target, reason: 'r' },
            { userId: 'u2', action: 'update', target: { ...target, userId: 'u2' }, reason: 'r' },
            { userId: 'u3', action: 'skip', reason: 'уже верно' },
        ]);

        expect(create).toHaveBeenCalledTimes(1);
        expect(create).toHaveBeenCalledWith({ data: expect.objectContaining({ userId: 'u1' }) });
        expect(update).toHaveBeenCalledTimes(1);
        expect(update).toHaveBeenCalledWith({ where: { userId: 'u2' }, data: expect.not.objectContaining({ userId: expect.anything() }) });
        expect(result).toEqual({ created: 1, updated: 1, skipped: 1 });
    });

    it('повторный apply одного и того же (теперь всё skip) плана не делает ни одной записи', async () => {
        const create = vi.fn(async () => ({}));
        const update = vi.fn(async () => ({}));
        const db = { subscription: { create, update } };

        const result = await applyBackfill(db, [
            { userId: 'u1', action: 'skip', reason: 'уже верно' },
            { userId: 'u2', action: 'skip', reason: 'уже верно' },
        ]);

        expect(create).not.toHaveBeenCalled();
        expect(update).not.toHaveBeenCalled();
        expect(result).toEqual({ created: 0, updated: 0, skipped: 2 });
    });
});
