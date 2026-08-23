/**
 * Падение одного запроса не роняет экран (ТЗ §4, приёмка §9).
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/cache', () => ({
    revalidateTag: vi.fn(),
    unstable_cache: (fn: (...args: unknown[]) => unknown) => fn,
}));

const groupBy = vi.fn();
const findMany = vi.fn();
const findFirst = vi.fn();
const count = vi.fn();

vi.mock('@/lib/db', () => ({
    db: {
        diarySession: { findMany: () => findMany(), groupBy: () => groupBy(), count: () => count() },
        payment: { groupBy: () => groupBy(), findMany: () => findMany(), count: () => count() },
        infraPulse: { findFirst: () => findFirst() },
        systemConfig: { findMany: () => findMany() },
        // Лампа «Приложение» с этого потока считает сигнал от ЗАПИСОК и
        // МОМЕНТОВ вместо безусловной серой заглушки, поэтому у неё, как и у
        // остальных блоков экрана, появился собственный вызов к базе. Раньше
        // она годилась в этом тесте на роль «блока, который не может упасть»
        // просто потому, что ни о чём не спрашивала.
        analyticsEvent: { count: () => count() },
    },
}));

describe('устойчивость экрана', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    it('упавший запрос отдаётся как broken, остальные блоки приходят как есть', async () => {
        // Главная метрика падает…
        findMany.mockRejectedValue(new Error('соединение с базой потеряно'));
        // …а лампа «Деньги» отвечает нормально.
        groupBy.mockResolvedValue([
            { status: 'paid', _count: { _all: 96 } },
            { status: 'failed', _count: { _all: 4 } },
        ]);
        findFirst.mockResolvedValue(null);
        // …и лампа «Приложение» тоже: сигнал от приложений есть.
        count.mockResolvedValue(7);

        const { screen } = await import('../build');
        const result = await screen('morning');

        expect(result.blocks.sessionsWeekly.state).toBe('broken');
        expect(result.blocks.sessionsWeekly.reason).toContain('соединение с базой потеряно');

        // Экран собрался целиком, а не упал вместе с блоком.
        expect(Object.keys(result.blocks)).toContain('lampMoney');
        expect(result.blocks.lampMoney.state).toBe('ok');
        expect(result.blocks.lampApp.state).toBe('ok');
        expect(result.blocks.attention).toBeDefined();
    });

    it('каждый блок экрана несёт непустой source', async () => {
        findMany.mockResolvedValue([]);
        groupBy.mockResolvedValue([]);
        findFirst.mockResolvedValue(null);
        // …и лампа «Приложение» тоже: сигнал от приложений есть.
        count.mockResolvedValue(7);

        const { screen } = await import('../build');
        const result = await screen('morning');

        for (const [key, block] of Object.entries(result.blocks)) {
            expect(block.source, `блок ${key} без источника`).toBeTruthy();
        }
    });

    it('у каждого блока не в состоянии ok есть непустая причина', async () => {
        findMany.mockResolvedValue([]);
        groupBy.mockResolvedValue([]);
        findFirst.mockResolvedValue(null);
        // …и лампа «Приложение» тоже: сигнал от приложений есть.
        count.mockResolvedValue(7);

        const { screen } = await import('../build');
        const result = await screen('morning');

        for (const [key, block] of Object.entries(result.blocks)) {
            if (block.state === 'ok' || block.state === 'loading') continue;
            expect(block.reason, `блок ${key} в состоянии ${block.state} без причины`).toBeTruthy();
        }
    });
});
