/**
 * Общий доступ к показаниям инфраструктуры.
 *
 * Источник — модель `InfraPulse`, которую наполняет готовый коллектор
 * `src/lib/infra-pulse/`. Панель его только читает: ни второго сборщика,
 * ни второго клиента базы (ТЗ §1, §11 «панель только читает»).
 */

import { db } from '@/lib/db';

export type InfraRow = Awaited<ReturnType<typeof db.infraPulse.findFirst>>;

/** Показания старее этого срока считаются устаревшими: коллектор ходит раз в ~5 минут. */
export const PULSE_STALE_MINUTES = 30;

export interface PulseSnapshot {
    row: NonNullable<InfraRow>;
    collectedAt: Date;
    isStale: boolean;
    ageMinutes: number;
}

/** Последнее показание. `null` — коллектор не присылал ничего ни разу. */
export async function latestPulse(): Promise<PulseSnapshot | null> {
    const row = await db.infraPulse.findFirst({ orderBy: { collectedAt: 'desc' } });
    if (!row) return null;
    const ageMinutes = (Date.now() - row.collectedAt.getTime()) / 60000;
    return { row, collectedAt: row.collectedAt, isStale: ageMinutes > PULSE_STALE_MINUTES, ageMinutes };
}

/** История показаний за N дней — для графиков «Техники». */
export async function pulseHistory(days = 30) {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    return db.infraPulse.findMany({
        where: { collectedAt: { gte: since } },
        orderBy: { collectedAt: 'asc' },
        select: {
            collectedAt: true,
            cpuPercent: true,
            diskUsedBytes: true,
            diskTotalBytes: true,
            dbSizeBytes: true,
            backupAgeHours: true,
        },
    });
}

export const NO_PULSE_REASON = 'коллектор показаний ещё не присылал данных';

export interface RemindersReading {
    due: number;
    sent: number;
    sentTwice: number;
    /** % от due, что реально ушло. null — due=0, делить не на что (честный ноль, не отсутствие данных). */
    sentRate: number | null;
}

/**
 * Общее чтение remindersDue/remindersSent/remindersSentTwice из одного
 * показания `InfraPulse`.
 *
 * Раньше «Утро» (`q_lamp_reminders`) и «Продукты» (`q_practice_reminders`)
 * читали эти три поля каждый по-своему и по-разному отвечали на
 * `remindersDue === 0`: один блок говорил `no_data`, другой — `ok`. Панель
 * спорила сама с собой на одних и тех же цифрах одного показания. Теперь
 * оба зовут эту функцию, так что у них физически не может остаться два
 * разных мнения о том же показании — это же проверяет
 * `tests/panel-reminders-source-agreement.test.ts`.
 *
 * `null` — коллектор ещё ни разу не снимал журнал отправок (`remindersDue`
 * в показании ещё не заполнен). `remindersDue === 0` — это не тот случай:
 * журнал снят, и в нём честно ноль напоминаний к отправке за сутки.
 */
export function readReminders(row: { remindersDue: number | null; remindersSent: number | null; remindersSentTwice: number | null }): RemindersReading | null {
    if (row.remindersDue === null) return null;
    const due = row.remindersDue;
    const sent = row.remindersSent ?? 0;
    const sentTwice = row.remindersSentTwice ?? 0;
    return { due, sent, sentTwice, sentRate: due > 0 ? (sent / due) * 100 : null };
}

export function staleReason(ageMinutes: number): string {
    const hours = ageMinutes / 60;
    return hours >= 1
        ? `коллектор молчит ${Math.floor(hours)} ч — показания на последнюю удачную выгрузку`
        : `коллектор молчит ${Math.round(ageMinutes)} мин — показания на последнюю удачную выгрузку`;
}

export interface ContainerReading {
    name: string;
    running: boolean;
    uptimeSeconds: number;
    restarts24h: number;
}

/** `containers` хранится как Json — разбираем защищённо, чужой формат не роняет экран. */
export function parseContainers(value: unknown): ContainerReading[] | null {
    if (!Array.isArray(value)) return null;
    const out: ContainerReading[] = [];
    for (const item of value) {
        if (!item || typeof item !== 'object') continue;
        const r = item as Record<string, unknown>;
        if (typeof r.name !== 'string') continue;
        out.push({
            name: r.name,
            running: r.running === true,
            uptimeSeconds: typeof r.uptimeSeconds === 'number' ? r.uptimeSeconds : 0,
            restarts24h: typeof r.restarts24h === 'number' ? r.restarts24h : 0,
        });
    }
    return out.length ? out : null;
}

export interface DriftReading {
    onlyInRepo: string[];
    onlyInDb: string[];
    total: number;
}

export function parseDrift(value: unknown): DriftReading | null {
    if (!value || typeof value !== 'object') return null;
    const r = value as Record<string, unknown>;
    const onlyInRepo = Array.isArray(r.onlyInRepo) ? r.onlyInRepo.filter((x): x is string => typeof x === 'string') : [];
    const onlyInDb = Array.isArray(r.onlyInDb) ? r.onlyInDb.filter((x): x is string => typeof x === 'string') : [];
    return { onlyInRepo, onlyInDb, total: onlyInRepo.length + onlyInDb.length };
}

export interface TableSize {
    name: string;
    bytes: number;
}

export function parseTopTables(value: unknown): TableSize[] | null {
    if (!Array.isArray(value)) return null;
    const out: TableSize[] = [];
    for (const item of value) {
        if (!item || typeof item !== 'object') continue;
        const r = item as Record<string, unknown>;
        if (typeof r.name !== 'string') continue;
        const bytes = typeof r.bytes === 'number' ? r.bytes : typeof r.bytes === 'string' ? Number(r.bytes) : NaN;
        if (Number.isNaN(bytes)) continue;
        out.push({ name: r.name, bytes });
    }
    return out.length ? out : null;
}

export function parseRowCounts(value: unknown): Record<string, number> | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        if (typeof v === 'number') out[k] = v;
        else if (typeof v === 'string' && !Number.isNaN(Number(v))) out[k] = Number(v);
    }
    return Object.keys(out).length ? out : null;
}

export interface WebhookRates {
    telegram: { rate: number; checkedAt: string } | null;
    max: { rate: number; checkedAt: string } | null;
}

export function parseWebhookRates(value: unknown): WebhookRates | null {
    if (!value || typeof value !== 'object') return null;
    const r = value as Record<string, unknown>;
    const pick = (raw: unknown) => {
        if (!raw || typeof raw !== 'object') return null;
        const o = raw as Record<string, unknown>;
        if (typeof o.rate !== 'number' || typeof o.checkedAt !== 'string') return null;
        return { rate: o.rate, checkedAt: o.checkedAt };
    };
    const telegram = pick(r.telegram);
    const max = pick(r.max);
    return telegram || max ? { telegram, max } : null;
}

export interface InfraCost {
    server: number | null;
    storage: number | null;
    domains: number | null;
    total: number | null;
    source: 'manual' | 'api';
    updatedAt: string | null;
}

export function parseInfraCost(value: unknown): InfraCost | null {
    if (!value || typeof value !== 'object') return null;
    const r = value as Record<string, unknown>;
    const numOrNull = (v: unknown) => (typeof v === 'number' ? v : null);
    const total = numOrNull(r.total);
    const parts = [numOrNull(r.server), numOrNull(r.storage), numOrNull(r.domains)];
    if (total === null && parts.every((p) => p === null)) return null;
    return {
        server: parts[0],
        storage: parts[1],
        domains: parts[2],
        total: total ?? parts.reduce<number>((acc, p) => acc + (p ?? 0), 0),
        source: r.source === 'api' ? 'api' : 'manual',
        updatedAt: typeof r.updatedAt === 'string' ? r.updatedAt : null,
    };
}
