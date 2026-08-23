// B3: money.ts должен честно отличать "оплат/подписок не было" от "таблица
// Subscription пуста, потому что запись в неё раньше была за выключенным
// флагом" (B1) или ещё не забэкафилена (B2). До фикса qPayingUsers всегда
// возвращал ok с active=0/trial=0/grace=0, даже когда Payment показывает
// реальную выручку — ложный ноль (ТЗ §4: no_data никогда не рисуется нулём).
// qMrrMonthly возвращал ok с 12 нулевыми бакетами, когда за окно вообще не
// было ни одного оплаченного платежа — та же ошибка на другом блоке.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const paymentFindMany = vi.fn();
const paymentGroupBy = vi.fn();
const subscriptionCount = vi.fn();
const subscriptionFindMany = vi.fn();

vi.mock('@/lib/db', () => ({
    db: {
        payment: {
            findMany: (...args: unknown[]) => paymentFindMany(...args),
            groupBy: (...args: unknown[]) => paymentGroupBy(...args),
        },
        subscription: {
            count: (...args: unknown[]) => subscriptionCount(...args),
            findMany: (...args: unknown[]) => subscriptionFindMany(...args),
        },
    },
}));

import { qMrrMonthly, qPayingUsers } from '@/lib/panel/queries/money';

beforeEach(() => {
    paymentFindMany.mockReset();
    paymentGroupBy.mockReset();
    subscriptionCount.mockReset();
    subscriptionFindMany.mockReset();
});

describe('qMrrMonthly — измеренный ноль против отсутствия данных', () => {
    it('за 12 месяцев не было ни одного оплаченного платежа — no_data, а не 12 нулевых точек', async () => {
        paymentFindMany.mockResolvedValue([]);
        const block = await qMrrMonthly();
        expect(block.state).toBe('no_data');
        expect(block.data).toBeNull();
    });

    it('есть оплаченные платежи — ok с реальными суммами по месяцам', async () => {
        const now = new Date();
        paymentFindMany.mockResolvedValue([{ amount: 99000, createdAt: now, months: 1 }]);
        const block = await qMrrMonthly();
        expect(block.state).toBe('ok');
        expect(block.data?.current).toBe(99000);
    });
});

describe('qPayingUsers — не читает пустую Subscription как честный ноль', () => {
    it('Subscription полностью пуста — no_data, а не active:0/trial:0/grace:0', async () => {
        subscriptionCount.mockResolvedValue(0);
        const block = await qPayingUsers();
        expect(block.state).toBe('no_data');
        expect(block.data).toBeNull();
        expect(block.reason).toBeTruthy();
    });

    it('Subscription заполнена — ok с реальными счётчиками по статусам', async () => {
        // Порядок вызовов в qPayingUsers: total count, затем active/trial/grace/started/churned.
        subscriptionCount
            .mockResolvedValueOnce(10) // total (guard)
            .mockResolvedValueOnce(6) // active
            .mockResolvedValueOnce(2) // trial
            .mockResolvedValueOnce(1) // grace
            .mockResolvedValueOnce(1) // startedThisMonth
            .mockResolvedValueOnce(0); // churnedThisMonth
        const block = await qPayingUsers();
        expect(block.state).toBe('ok');
        expect(block.data).toMatchObject({ active: 6, trial: 2, grace: 1 });
    });
});
