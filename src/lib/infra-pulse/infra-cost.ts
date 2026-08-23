// Карточка «Стоимость инфраструктуры» (ТЗ_management_dashboard.md §6.1,
// InfraPulse.infraCostRub). Расходы вводятся руками через `SystemConfig`
// (src/lib/panel/queries/config.ts, INFRA_COST_KEY = 'infra_cost_rub';
// пишет src/app/admin/panel/actions.ts:setInfraCost) — ключ здесь
// продублирован намеренно, не импортирован из кода панели: infra-pulse не
// зависит от панели, только от формы значения, которое панель туда кладёт.
// Значение — уже готовый JSON `{server, storage, domains, source,
// updatedAt}`; коллектор досчитывает `total` и переносит снимок в свою
// таблицу, как он уже делает с DeployLog и Payment (SELECT чужих таблиц,
// не порождение новых источников истины).

import type { PrismaClient } from '@prisma/client';

export const INFRA_COST_CONFIG_KEY = 'infra_cost_rub';

export interface InfraCostReading {
    server: number | null;
    storage: number | null;
    domains: number | null;
    total: number;
    source: 'manual' | 'api';
    updatedAt: string | null;
}

/** Чистый разбор значения SystemConfig.value — без похода в базу, легко тестируется. */
export function parseInfraCostConfigValue(raw: string | null | undefined): InfraCostReading | null {
    if (!raw || raw === 'false') return null;
    let parsed: Record<string, unknown>;
    try {
        parsed = JSON.parse(raw) as Record<string, unknown>;
    } catch {
        return null;
    }
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
        source: parsed.source === 'api' ? 'api' : 'manual',
        updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : null,
    };
}

type Db = Pick<PrismaClient, 'systemConfig'>;

export async function readInfraCost(db: Db): Promise<InfraCostReading | null> {
    const row = await db.systemConfig.findUnique({ where: { key: INFRA_COST_CONFIG_KEY } });
    return parseInfraCostConfigValue(row?.value ?? null);
}
