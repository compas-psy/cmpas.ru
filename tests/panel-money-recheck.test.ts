// Перепроверка по требованию задачи: q_paying_users, q_trial_conversion,
// q_revenue_churn, q_mrr_waterfall (money.ts) и q_churn_count (retention.ts)
// читают Subscription (в бою — 1 строка, статус churned), но раньше аудит
// проверялся на СОВЕРШЕННО пустой Subscription. Живой факт новее: Payment
// теперь содержит paid=1, а Subscription — не пуста (1 строка). Этот файл
// доказывает прогоном (не полагаясь на аудит месячной давности), что при
// «почти пустой», но НЕ ПУСТОЙ Subscription/Payment эти блоки уже отвечают
// ok с настоящими (пусть и маленькими) числами, а не голым no_data — то
// есть отдельного фикса под B в них не нужно, только проверка.
//
// Единственный блок этой группы, которому окно чинили по-настоящему —
// q_payments_daily/q_lamp_money — see panel-money-subscription-source.test.ts
// и тесты окна в других файлах; здесь — только "почти пустая Subscription".

import { describe, it, expect, vi, beforeEach } from 'vitest';

const subscriptionCount = vi.fn();
const subscriptionFindMany = vi.fn();
const paymentFindMany = vi.fn();

vi.mock('@/lib/db', () => ({
    db: {
        subscription: {
            count: (...args: unknown[]) => subscriptionCount(...args),
            findMany: (...args: unknown[]) => subscriptionFindMany(...args),
        },
        payment: {
            findMany: (...args: unknown[]) => paymentFindMany(...args),
        },
    },
}));

import { qPayingUsers, qTrialConversion, qRevenueChurn, qMrrWaterfall } from '@/lib/panel/queries/money';
import { qChurnCount } from '@/lib/panel/queries/retention';

beforeEach(() => {
    subscriptionCount.mockReset();
    subscriptionFindMany.mockReset();
    paymentFindMany.mockReset();
});

describe('qPayingUsers — Subscription почти пуста (1 строка, churned), но не пуста', () => {
    it('Subscription абсолютно пуста — no_data (не изменилось)', async () => {
        subscriptionCount.mockResolvedValue(0);
        const block = await qPayingUsers();
        expect(block.state).toBe('no_data');
    });

    it('1 строка Subscription (churned) — ok с честными нулями active/trial/grace, а не no_data', async () => {
        // Порядок вызовов: total (guard), active, trial, grace, startedThisMonth, churnedThisMonth.
        subscriptionCount
            .mockResolvedValueOnce(1) // total
            .mockResolvedValueOnce(0) // active
            .mockResolvedValueOnce(0) // trial
            .mockResolvedValueOnce(0) // grace
            .mockResolvedValueOnce(0) // startedThisMonth
            .mockResolvedValueOnce(1); // churnedThisMonth — эта одна строка ушла недавно
        const block = await qPayingUsers();
        expect(block.state).toBe('ok');
        expect(block.data).toMatchObject({ active: 0, trial: 0, grace: 0 });
    });
});

describe('qRevenueChurn — база на начало периода уже не пуста при 1 строке Subscription', () => {
    it('Subscription пуста целиком — no_data', async () => {
        subscriptionCount.mockResolvedValue(0);
        const block = await qRevenueChurn();
        expect(block.state).toBe('no_data');
    });

    it('1 строка Subscription, стартовавшая давно — base=1, ok, а не no_data', async () => {
        // Вызовы по порядку: [churned_current, base_current, churned_previous, base_previous].
        subscriptionCount.mockResolvedValueOnce(1).mockResolvedValueOnce(1).mockResolvedValueOnce(0).mockResolvedValueOnce(1);
        const block = await qRevenueChurn();
        expect(block.state).toBe('ok');
        expect(block.data).toMatchObject({ churned: 1, base: 1 });
    });
});

describe('qTrialConversion — когорта по-прежнему может быть пустой при 1 подписке (честно, не наш фикс)', () => {
    it('в когорте 30–60 дней назад подписок нет — no_data (эта причина настоящая: 1 подписка почти наверняка мимо узкого среза)', async () => {
        subscriptionCount.mockResolvedValueOnce(0).mockResolvedValueOnce(0).mockResolvedValueOnce(0).mockResolvedValueOnce(0);
        const block = await qTrialConversion();
        expect(block.state).toBe('no_data');
    });

    it('когорта нашлась — ok с измеренной долей, а не no_data', async () => {
        // Вызовы по порядку: [cohort_current, converted_current, cohort_previous, converted_previous].
        subscriptionCount.mockResolvedValueOnce(1).mockResolvedValueOnce(1).mockResolvedValueOnce(0).mockResolvedValueOnce(0);
        const block = await qTrialConversion();
        expect(block.state).toBe('ok');
        expect(block.data).toMatchObject({ cohort: 1, converted: 1 });
    });
});

describe('qMrrWaterfall — Payment.paid=1 теперь есть: живой факт, который раньше давал no_data', () => {
    it('ни оплат, ни оттока за оба периода — no_data (не изменилось)', async () => {
        paymentFindMany.mockResolvedValue([]);
        subscriptionFindMany.mockResolvedValue([]);
        const block = await qMrrWaterfall();
        expect(block.state).toBe('no_data');
    });

    it('один оплаченный платёж за 30 дней — ok, водопад строится из одной строки', async () => {
        // Порядок вызовов: fresh (payment), churned (subscription), recent (payment), earlier (payment).
        paymentFindMany
            .mockResolvedValueOnce([{ amount: 99000, months: 1, userId: 'u1' }]) // fresh
            .mockResolvedValueOnce([{ amount: 99000, months: 1, userId: 'u1' }]) // recent (тот же платёж, независимый запрос)
            .mockResolvedValueOnce([]); // earlier
        subscriptionFindMany.mockResolvedValue([]); // churned

        const block = await qMrrWaterfall();

        expect(block.state).toBe('ok');
        expect(block.data?.newRevenue).toBe(99000);
    });
});

describe('qChurnCount (retention.ts) — тот же корень, что у qRevenueChurn', () => {
    it('Subscription пуста целиком — no_data', async () => {
        subscriptionCount.mockResolvedValue(0);
        const block = await qChurnCount();
        expect(block.state).toBe('no_data');
    });

    it('1 строка Subscription, стартовавшая раньше периода — base=1, ok', async () => {
        // Порядок: [churned, base].
        subscriptionCount.mockResolvedValueOnce(1).mockResolvedValueOnce(1);
        const block = await qChurnCount();
        expect(block.state).toBe('ok');
        expect(block.data).toMatchObject({ churned: 1, base: 1 });
    });
});
