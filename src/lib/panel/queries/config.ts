/**
 * Чтение ручных значений из `SystemConfig`.
 *
 * `SystemConfig` — единственная таблица, куда панель имеет право писать
 * (ТЗ §11), и то лишь для значений, которые вводит человек: стоимость
 * инфраструктуры и дата учебного восстановления копии.
 */

import { db } from '@/lib/db';

/** Дата последнего учебного восстановления копии (ТЗ §6.3). */
export const BACKUP_DRILL_KEY = 'backup_restore_drill_at';
/** Ручной ввод статей расхода на инфраструктуру (ТЗ §6.1). */
export const INFRA_COST_KEY = 'infra_cost_rub';

export async function readConfig(keys: string[]): Promise<Map<string, string>> {
    const rows = await db.systemConfig.findMany({ where: { key: { in: keys } } });
    return new Map(rows.map((r) => [r.key, r.value]));
}

export async function backupDrillAt(): Promise<Date | null> {
    const map = await readConfig([BACKUP_DRILL_KEY]);
    const raw = map.get(BACKUP_DRILL_KEY);
    if (!raw || raw === 'false' || !raw.trim()) return null;
    const date = new Date(raw);
    return Number.isNaN(date.getTime()) ? null : date;
}

export interface ManualInfraCost {
    server: number | null;
    storage: number | null;
    domains: number | null;
    total: number;
    updatedAt: string | null;
}

/**
 * Стоимость инфраструктуры вводится руками — это честнее, чем интеграция
 * с биллингом хостера ради четырёх чисел (ТЗ §6.1).
 */
export async function manualInfraCost(): Promise<ManualInfraCost | null> {
    const map = await readConfig([INFRA_COST_KEY]);
    const raw = map.get(INFRA_COST_KEY);
    if (!raw || raw === 'false') return null;
    try {
        const parsed = JSON.parse(raw) as Record<string, unknown>;
        const num = (v: unknown) => (typeof v === 'number' ? v : null);
        const server = num(parsed.server);
        const storage = num(parsed.storage);
        const domains = num(parsed.domains);
        if (server === null && storage === null && domains === null) return null;
        return {
            server,
            storage,
            domains,
            total: (server ?? 0) + (storage ?? 0) + (domains ?? 0),
            updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : null,
        };
    } catch {
        return null;
    }
}
