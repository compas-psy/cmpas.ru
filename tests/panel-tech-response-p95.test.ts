// q_tech_response_p95 (ТЗ §5, экран 6) раньше был жёстко закодирован как
// noData — источника не было вовсе. Теперь он читает InfraPulse.responseP95Ms,
// который заполняет коллектор (см. src/lib/infra-pulse/collector.ts,
// tests/infra-pulse.test.ts). Честность: пустое/устаревшее показание —
// по-прежнему noData/stale, а не выдуманное число.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const findFirst = vi.fn();
vi.mock('@/lib/db', () => ({ db: { infraPulse: { findFirst: (...args: unknown[]) => findFirst(...args) } } }));

import { qTechResponseP95 } from '@/lib/panel/queries/tech';

describe('qTechResponseP95 (O-260817-12/§5)', () => {
    beforeEach(() => {
        findFirst.mockReset();
    });

    it('no_data, если коллектор ещё ни разу не присылал показаний', async () => {
        findFirst.mockResolvedValue(null);
        const block = await qTechResponseP95();
        expect(block.state).toBe('no_data');
        expect(block.data).toBeNull();
    });

    it('ok с числом, когда последнее показание свежее и содержит responseP95Ms', async () => {
        findFirst.mockResolvedValue({ collectedAt: new Date(), responseP95Ms: 340 });
        const block = await qTechResponseP95();
        expect(block.state).toBe('ok');
        expect(block.data).toEqual({ p95Ms: 340 });
    });

    it('no_data, если показание есть, но само поле ещё null — не выдумываем число из воздуха', async () => {
        findFirst.mockResolvedValue({ collectedAt: new Date(), responseP95Ms: null });
        const block = await qTechResponseP95();
        expect(block.state).toBe('no_data');
        expect(block.data).toBeNull();
    });

    it('stale, если последнее показание старше порога свежести', async () => {
        const old = new Date(Date.now() - 60 * 60000);
        findFirst.mockResolvedValue({ collectedAt: old, responseP95Ms: 340 });
        const block = await qTechResponseP95();
        expect(block.state).toBe('stale');
        expect(block.data).toEqual({ p95Ms: 340 });
    });
});
