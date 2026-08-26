/**
 * Экран 6 — «Техника». Почти всё уже собирает коллектор
 * `src/lib/infra-pulse/`: читаем последнее показание и историю за 30 дней,
 * ничего не пересобирая (ТЗ §1, §5).
 */

import { db } from '@/lib/db';
import { noData, ok, stale, type PanelBlock } from '../types';
import { severityFor } from '../thresholds';
import {
    latestPulse,
    NO_PULSE_REASON,
    parseContainers,
    parseDrift,
    parseInfraCost,
    parseRowCounts,
    parseTopTables,
    parseWebhookRates,
    staleReason,
    type ContainerReading,
    type DriftReading,
    type TableSize,
    type WebhookRates,
} from './infra';
import { backupDrillAt, manualInfraCost, type ManualInfraCost } from './config';
import { redact } from '../redact';

/** Оборачивает данные в ok/stale по свежести показания — одно место на весь экран. */
function fromPulse<T>(source: string, data: T, pulse: NonNullable<Awaited<ReturnType<typeof latestPulse>>>): PanelBlock<T> {
    const at = pulse.collectedAt.toISOString();
    return pulse.isStale ? stale(source, data, staleReason(pulse.ageMinutes), at) : ok(source, data, at);
}

export interface ServerCard {
    cpuPercent: number | null;
    memUsedBytes: string | null;
    memTotalBytes: string | null;
    diskUsedBytes: string | null;
    diskTotalBytes: string | null;
    diskFreePercent: number | null;
    certDaysLeft: number | null;
    containers: ContainerReading[] | null;
}

export async function qTechServer(): Promise<PanelBlock<ServerCard>> {
    const pulse = await latestPulse();
    if (!pulse) return noData('q_tech_server', NO_PULSE_REASON);
    const { row } = pulse;

    const used = row.diskUsedBytes === null ? null : Number(row.diskUsedBytes);
    const total = row.diskTotalBytes === null ? null : Number(row.diskTotalBytes);
    const diskFreePercent = used !== null && total !== null && total > 0 ? ((total - used) / total) * 100 : null;

    return fromPulse<ServerCard>(
        'q_tech_server',
        {
            cpuPercent: row.cpuPercent,
            // BigInt не сериализуется в JSON — отдаём строками, чтобы ответ
            // API можно было отдать и проверить тестом как есть.
            memUsedBytes: row.memUsedBytes?.toString() ?? null,
            memTotalBytes: row.memTotalBytes?.toString() ?? null,
            diskUsedBytes: row.diskUsedBytes?.toString() ?? null,
            diskTotalBytes: row.diskTotalBytes?.toString() ?? null,
            diskFreePercent,
            certDaysLeft: row.certDaysLeft,
            containers: parseContainers(row.containers),
        },
        pulse,
    );
}

export interface ResponseP95Card {
    p95Ms: number;
}

/**
 * Источник появился (O-260817-12/§5): src/proxy.ts меряет каждый запрос,
 * src/lib/cron/response-time.ts раз в ~5 минут пишет окно в AppResponseTime,
 * а коллектор переносит последний ещё не устаревший p95 в свой снимок
 * InfraPulse.responseP95Ms — читаем его так же, как остальные карточки
 * этого экрана, тем же fromPulse.
 */
export async function qTechResponseP95(): Promise<PanelBlock<ResponseP95Card>> {
    const pulse = await latestPulse();
    if (!pulse) return noData('q_tech_response_p95', NO_PULSE_REASON);
    const { row } = pulse;
    if (row.responseP95Ms === null || row.responseP95Ms === undefined) {
        return noData('q_tech_response_p95', 'приложение ещё не отдало ни одного полного окна замеров времени ответа');
    }
    return fromPulse<ResponseP95Card>('q_tech_response_p95', { p95Ms: row.responseP95Ms }, pulse);
}

export interface DbCard {
    sizeBytes: string | null;
    topTables: TableSize[] | null;
    rowCounts: Record<string, number> | null;
    migrationsApplied: number | null;
    migrationsUnfinished: number | null;
    drift: DriftReading | null;
}

export async function qTechDb(): Promise<PanelBlock<DbCard>> {
    const pulse = await latestPulse();
    if (!pulse) return noData('q_tech_db', NO_PULSE_REASON);
    const { row } = pulse;

    return fromPulse<DbCard>(
        'q_tech_db',
        {
            sizeBytes: row.dbSizeBytes?.toString() ?? null,
            topTables: parseTopTables(row.dbTopTables),
            rowCounts: parseRowCounts(row.dbRowCounts),
            migrationsApplied: row.migrationsApplied,
            migrationsUnfinished: row.migrationsUnfinished,
            drift: parseDrift(row.migrationsDrift),
        },
        pulse,
    );
}

/**
 * Хранилище ЗАПИСОК. Причина «общего приёмника ещё нет» устарела — приёмник
 * есть и события ЗАПИСОК в него доезжают (потоки A/B/E). Не хватает другого,
 * и это стоит называть точно: занятое место — не поведенческое событие, а
 * состояние на чужом сервере, и в `analytics/schema/events.yaml` нет ни
 * одного события про квоту или объём хранилища. Пока такое событие не
 * объявлено в реестре и не начало отправляться сервером ЗАПИСОК, считать
 * нечего — а лезть в чужую базу напрямую значит завести второй контур
 * данных, чего `charter/12_ANALYTICS.md §3` прямо не велит («второй сервер
 * не строим»).
 */
export async function qTechZapiskiStorage(): Promise<PanelBlock<never>> {
    return noData(
        'q_tech_zapiski_storage',
        'нужно завести событие про объём хранилища ЗАПИСОК в analytics/schema/events.yaml и начать отправлять его с сервера ЗАПИСОК — приёмник тут ни при чём, отправлять пока нечего',
    );
}

export interface DeployCard {
    total30d: number;
    rolledBack: number;
    /** «Остановлено предохранителем» — предотвращённая авария, это успех. */
    guardStopped: number;
    failed: number;
    recent: { id: string; startedAt: string; finishedAt: string | null; result: string; imageRef: string | null; errorNote: string | null }[];
    buildMinutesLeft: number | null;
}

export async function qTechDeploys(): Promise<PanelBlock<DeployCard>> {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const [rows, recent, pulse] = await Promise.all([
        db.deployLog.groupBy({ by: ['result'], where: { startedAt: { gte: since } }, _count: { _all: true } }),
        // Явный select: без него в ответ уезжают все колонки таблицы,
        // включая те, что появятся в ней позже (ТЗ §8).
        db.deployLog.findMany({
            orderBy: { startedAt: 'desc' },
            take: 6,
            select: { id: true, startedAt: true, finishedAt: true, result: true, imageRef: true, errorNote: true },
        }),
        latestPulse(),
    ]);

    if (rows.length === 0 && recent.length === 0) {
        return noData('q_tech_deploys', 'журнал выкладок пуст: скрипт деплоя ещё не писал в DeployLog');
    }

    const count = (result: string) => rows.find((r) => r.result === result)?._count._all ?? 0;

    return ok('q_tech_deploys', {
        total30d: rows.reduce((acc, r) => acc + r._count._all, 0),
        rolledBack: count('rolled_back'),
        guardStopped: count('schema_guard_stopped'),
        failed: count('failed'),
        recent: recent.map((r) => ({
            id: r.id,
            startedAt: r.startedAt.toISOString(),
            finishedAt: r.finishedAt?.toISOString() ?? null,
            result: r.result,
            imageRef: r.imageRef,
            // Свободный текст от скрипта выкладки — в нём попадаются пути.
            errorNote: redact(r.errorNote),
        })),
        buildMinutesLeft: pulse?.row.buildMinutesLeft ?? null,
    });
}

export interface BackupCard {
    ageHours: number | null;
    sizeBytes: string | null;
    sizeRatioYesterday: number | null;
    readable: boolean | null;
    /** ISO даты последнего учебного восстановления либо null — «никогда». */
    drillAt: string | null;
    /**
     * Пока учебного восстановления не было, карточка не может быть зелёной
     * ни при каких обстоятельствах (ТЗ §5, экран 6). Это правило считается
     * здесь, а не в разметке, и проверяется автотестом.
     */
    canBeGreen: boolean;
}

export async function qTechBackups(): Promise<PanelBlock<BackupCard>> {
    const [pulse, drill] = await Promise.all([latestPulse(), backupDrillAt()]);
    if (!pulse) return noData('q_tech_backups', NO_PULSE_REASON);
    const { row } = pulse;

    if (row.backupAgeHours === null && row.backupReadable === null && row.backupSizeBytes === null) {
        return noData('q_tech_backups', 'в показании нет данных о копиях', pulse.collectedAt.toISOString());
    }

    return fromPulse<BackupCard>(
        'q_tech_backups',
        {
            ageHours: row.backupAgeHours,
            sizeBytes: row.backupSizeBytes?.toString() ?? null,
            sizeRatioYesterday: row.backupSizeRatioYesterday,
            readable: row.backupReadable,
            drillAt: drill?.toISOString() ?? null,
            canBeGreen: drill !== null && row.backupReadable === true && severityFor('backupAgeHours', row.backupAgeHours) === 'ok',
        },
        pulse,
    );
}

export interface ChannelsCard {
    remindersDue: number | null;
    remindersSent: number | null;
    remindersSentTwice: number | null;
    webhooks: WebhookRates | null;
}

export async function qTechChannels(): Promise<PanelBlock<ChannelsCard>> {
    const pulse = await latestPulse();
    if (!pulse) return noData('q_tech_channels', NO_PULSE_REASON);
    const { row } = pulse;

    const webhooks = parseWebhookRates(row.webhookErrorRates);
    if (row.remindersDue === null && webhooks === null) {
        return noData(
            'q_tech_channels',
            'журнал отправок не заведён, доля ошибок вебхуков коллектором пока не снимается',
            pulse.collectedAt.toISOString(),
        );
    }

    return fromPulse<ChannelsCard>(
        'q_tech_channels',
        {
            remindersDue: row.remindersDue,
            remindersSent: row.remindersSent,
            remindersSentTwice: row.remindersSentTwice,
            webhooks,
        },
        pulse,
    );
}

/** Версия приложения в магазине — ответа магазина нет, это «не проверено». */
export async function qTechAppVersion(): Promise<PanelBlock<never>> {
    return noData(
        'q_tech_app_version',
        'нужно подключить периодический опрос Google Play (и App Store, если приложение там появится) за версией — сейчас магазин никто не опрашивает',
    );
}

export interface InfraCostCard extends ManualInfraCost {
    source: 'manual' | 'api';
}

/**
 * Стоимость инфраструктуры. Сперва смотрим ручной ввод в `SystemConfig`,
 * затем — поле показания, если коллектор научится его снимать.
 */
export async function qInfraCost(): Promise<PanelBlock<InfraCostCard>> {
    const manual = await manualInfraCost();
    if (manual) {
        const data = { ...manual, source: 'manual' as const };

        // Регламент владельца: статьи расхода обновляются раз в две недели.
        // Просроченное значение отдаётся как `stale`, а не как `ok`: цифра
        // месячной давности, выданная за свежую, хуже отсутствующей.
        const ageDays = manual.updatedAt
            ? (Date.now() - new Date(manual.updatedAt).getTime()) / (24 * 60 * 60 * 1000)
            : null;
        const severity = severityFor('infraCostAgeDays', ageDays);

        if (severity === 'warning' || severity === 'serious') {
            return stale(
                'q_infra_cost',
                data,
                `суммы не обновляли ${Math.floor(ageDays ?? 0)} дн — по регламенту раз в две недели`,
                manual.updatedAt,
            );
        }
        return ok('q_infra_cost', data, manual.updatedAt ?? undefined);
    }

    const pulse = await latestPulse();
    const fromPulseCost = pulse ? parseInfraCost(pulse.row.infraCostRub) : null;
    if (fromPulseCost) {
        return ok(
            'q_infra_cost',
            {
                server: fromPulseCost.server,
                storage: fromPulseCost.storage,
                domains: fromPulseCost.domains,
                total: fromPulseCost.total ?? 0,
                updatedAt: fromPulseCost.updatedAt,
                source: fromPulseCost.source,
            },
            pulse!.collectedAt.toISOString(),
        );
    }

    return noData('q_infra_cost', 'расходы никто не собирает: статьи вводятся руками, поле ещё пустое');
}
