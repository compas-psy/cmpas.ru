// 26.08 (решение учредителя): отказ приёма с известным источником И
// известным лекарством поднимается наверх экрана строкой действия, а не
// прячется в таблицу причин. Живой случай: "secret not allowed for
// product moments" значит "МОМЕНТЫ шлют, ждут ANALYTICS_INGEST_SECRET_MOMENTS
// и обновлённую сборку" — это самое полезное, что сегодня есть на экране.
//
// Не общий словарь на любую причину: для ПРАКТИКИ/ЗАПИСОК та же причина
// означала бы нечто иное (они делят один секрет, а не ждут отдельного) —
// лекарство называем только там, где оно действительно известно.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const analyticsEventCount = vi.fn();
const analyticsEventRejectedGroupBy = vi.fn();

vi.mock('@/lib/db', () => ({
    db: {
        analyticsEvent: { count: (...args: unknown[]) => analyticsEventCount(...args) },
        analyticsEventRejected: { groupBy: (...args: unknown[]) => analyticsEventRejectedGroupBy(...args) },
    },
}));

import { qRejectedEvents } from '@/lib/panel/queries/quality';

beforeEach(() => {
    analyticsEventCount.mockReset();
    analyticsEventRejectedGroupBy.mockReset();
});

describe('q_rejected_events: известные причины с известным лекарством — наверх экрана', () => {
    it('secret not allowed for product moments — известная причина, названо лекарство', async () => {
        analyticsEventCount.mockResolvedValue(1197);
        analyticsEventRejectedGroupBy.mockResolvedValue([
            { reason: 'secret not allowed for product moments', _count: { _all: 5 } },
            { reason: 'unknown event: something_else', _count: { _all: 1 } },
        ]);

        const block = await qRejectedEvents();

        expect(block.state).toBe('ok');
        expect(block.data?.knownIssues).toHaveLength(1);
        expect(block.data?.knownIssues[0]).toMatchObject({
            reason: 'secret not allowed for product moments',
            count: 5,
        });
        expect(block.data?.knownIssues[0].summary).toContain('ANALYTICS_INGEST_SECRET_MOMENTS');
    });

    it('secret not allowed for product practice — НЕ признаётся известным лекарством (другой смысл)', async () => {
        analyticsEventCount.mockResolvedValue(100);
        analyticsEventRejectedGroupBy.mockResolvedValue([
            { reason: 'secret not allowed for product practice', _count: { _all: 3 } },
        ]);

        const block = await qRejectedEvents();

        expect(block.data?.knownIssues).toHaveLength(0);
    });

    it('без совпадающих причин — knownIssues пуст, таблица reasons при этом полна', async () => {
        analyticsEventCount.mockResolvedValue(50);
        analyticsEventRejectedGroupBy.mockResolvedValue([
            { reason: 'unknown event: xyz', _count: { _all: 2 } },
        ]);

        const block = await qRejectedEvents();

        expect(block.data?.knownIssues).toHaveLength(0);
        expect(block.data?.reasons).toHaveLength(1);
    });
});
