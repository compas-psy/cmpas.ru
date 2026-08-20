/**
 * Правило резервных копий (ТЗ §5 экран 6, §6.3, приёмка §9).
 *
 * Пока `SystemConfig.backup_restore_drill_at` пуст, карточка «Резервные копии»
 * не может быть зелёной НИ ПРИ КАКИХ обстоятельствах — даже если копия свежая,
 * нужного размера и читается. Копии, которые никто не разворачивал, — это
 * файлы неизвестного качества, а не бэкап.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const findFirst = vi.fn();
const findMany = vi.fn();

vi.mock('@/lib/db', () => ({
    db: {
        infraPulse: { findFirst: () => findFirst() },
        systemConfig: { findMany: () => findMany() },
    },
}));

const PERFECT_PULSE = {
    collectedAt: new Date(),
    backupAgeHours: 2,
    backupSizeBytes: BigInt(1_900_000_000),
    backupSizeRatioYesterday: 1.01,
    backupReadable: true,
};

describe('карточка «Резервные копии»', () => {
    beforeEach(() => {
        findFirst.mockReset();
        findMany.mockReset();
    });

    it('не может быть зелёной, пока учебного восстановления не было', async () => {
        findFirst.mockResolvedValue(PERFECT_PULSE);
        findMany.mockResolvedValue([]); // ключ backup_restore_drill_at не заведён

        const { qTechBackups } = await import('../queries/tech');
        const block = await qTechBackups();

        expect(block.state).toBe('ok');
        expect(block.data?.drillAt).toBeNull();
        // Всё остальное идеально — и всё равно не зелёная.
        expect(block.data?.ageHours).toBe(2);
        expect(block.data?.readable).toBe(true);
        expect(block.data?.canBeGreen, 'карточка позеленела без учебного восстановления').toBe(false);
    });

    it('зеленеет только когда дата восстановления заполнена и копия в порядке', async () => {
        findFirst.mockResolvedValue(PERFECT_PULSE);
        findMany.mockResolvedValue([{ key: 'backup_restore_drill_at', value: new Date().toISOString() }]);

        const { qTechBackups } = await import('../queries/tech');
        const block = await qTechBackups();

        expect(block.data?.drillAt).not.toBeNull();
        expect(block.data?.canBeGreen).toBe(true);
    });

    it('дата восстановления есть, но копия не читается — всё равно не зелёная', async () => {
        findFirst.mockResolvedValue({ ...PERFECT_PULSE, backupReadable: false });
        findMany.mockResolvedValue([{ key: 'backup_restore_drill_at', value: new Date().toISOString() }]);

        const { qTechBackups } = await import('../queries/tech');
        expect((await qTechBackups()).data?.canBeGreen).toBe(false);
    });

    it('лампа «Бэкап» на «Утре» не опускается ниже «серьёзно» без восстановления', async () => {
        findFirst.mockResolvedValue(PERFECT_PULSE);
        findMany.mockResolvedValue([]);

        const { qLampBackup } = await import('../queries/morning');
        const block = await qLampBackup();

        expect(block.data?.lamp).toBe('serious');
        expect(block.data?.detail).toContain('учебного восстановления не было ни разу');
    });

    it('без единого показания коллектора блок пуст с причиной, а не с нулями', async () => {
        findFirst.mockResolvedValue(null);
        findMany.mockResolvedValue([]);

        const { qTechBackups } = await import('../queries/tech');
        const block = await qTechBackups();

        expect(block.state).toBe('no_data');
        expect(block.data).toBeNull();
        expect(block.reason).toBeTruthy();
    });
});
