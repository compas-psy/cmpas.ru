/**
 * Экран 5 — «Удержание».
 *
 * Когорты специалистов считаются по `User.createdAt` и активности в
 * `DiarySession`. Ячейки, для которых срок ещё не наступил, помечаются
 * отдельным состоянием «рано» — это НЕ `no_data` и тем более не ноль.
 */

import { db } from '@/lib/db';
import { noData, ok, type PanelBlock } from '../types';
import { dateOf } from '../format';
import { MOMENTY_NOT_LAUNCHED_REASON } from './products';

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;

/** Ячейка тепловой карты: измеренная доля, «рано» или «данных нет». */
export type CohortCell =
    | { kind: 'value'; percent: number }
    | { kind: 'too_early' }
    | { kind: 'no_data'; reason: string };

export interface CohortRow {
    label: string;
    size: number;
    cells: CohortCell[];
}

export interface CohortsData {
    /** Подписи колонок: W0…W5. */
    columns: string[];
    rows: CohortRow[];
    /**
     * Когда `rows` пуст (в окно наблюдения никто не зарегистрировался) —
     * контекст вместо голой пустоты: дата последней регистрации вообще и
     * сколько дней назад. `undefined`, если строки есть — полю нечего добавить.
     */
    lastRegisteredAt?: string | null;
    daysSinceLastRegistered?: number | null;
}

const COHORT_COUNT = 4;
const WEEK_COUNT = 6;

/**
 * `q_cohorts_practice` — недельные когорты специалистов.
 * Когорта — все, кто зарегистрировался на одной неделе; удержание на неделе N —
 * доля из них, у кого на этой неделе была хоть одна сессия.
 *
 * Тот же корень, что у `q_funnel_practice`: окно наблюдения (9 недель) на
 * редких регистрациях (7 специалистов за 90 дней) может не поймать ни
 * одной. Пустая таблица когорт — честный ноль этого окна, а не «данных
 * нет», если специалисты вообще когда-то регистрировались: возвращаем `ok`
 * с пустыми строками и датой последней регистрации, которую страница может
 * показать вместо шести пунктирных клеток.
 */
export async function qCohortsPractice(): Promise<PanelBlock<CohortsData>> {
    const now = Date.now();
    // Когорты берём подряд, начиная с самой старой из окна наблюдения.
    const oldestStart = now - (COHORT_COUNT + WEEK_COUNT - 1) * WEEK_MS;

    const users = await db.user.findMany({
        where: { createdAt: { gte: new Date(oldestStart) } },
        select: { id: true, createdAt: true },
    });

    if (users.length === 0) {
        const last = await db.user.findFirst({ orderBy: { createdAt: 'desc' }, select: { createdAt: true } });
        if (!last) {
            return noData('q_cohorts_practice', 'специалистов в базе ещё нет — когортам не из кого сложиться');
        }
        return ok('q_cohorts_practice', {
            columns: Array.from({ length: WEEK_COUNT }, (_, i) => `W${i}`),
            rows: [],
            lastRegisteredAt: last.createdAt.toISOString(),
            daysSinceLastRegistered: Math.floor((now - last.createdAt.getTime()) / DAY_MS),
        });
    }

    const sessions = await db.diarySession.findMany({
        where: { psychologistId: { in: users.map((u) => u.id) }, date: { gte: new Date(oldestStart) } },
        select: { psychologistId: true, date: true },
    });

    const activity = new Map<string, Set<number>>();
    for (const s of sessions) {
        const set = activity.get(s.psychologistId) ?? new Set<number>();
        set.add(Math.floor(s.date.getTime() / WEEK_MS));
        activity.set(s.psychologistId, set);
    }

    const rows: CohortRow[] = [];

    for (let c = COHORT_COUNT - 1; c >= 0; c -= 1) {
        const cohortStart = now - (c + WEEK_COUNT - 1) * WEEK_MS;
        const cohortEnd = cohortStart + WEEK_MS;
        const members = users.filter((u) => u.createdAt.getTime() >= cohortStart && u.createdAt.getTime() < cohortEnd);

        const cells: CohortCell[] = [];
        for (let w = 0; w < WEEK_COUNT; w += 1) {
            const weekStart = cohortStart + w * WEEK_MS;

            if (weekStart + WEEK_MS > now) {
                // Неделя ещё не закончилась — срок не наступил, а не «ноль».
                cells.push({ kind: 'too_early' });
                continue;
            }
            if (members.length === 0) {
                cells.push({ kind: 'no_data', reason: 'в когорте никого нет' });
                continue;
            }

            const bucket = Math.floor(weekStart / WEEK_MS);
            const retained = members.filter((m) => activity.get(m.id)?.has(bucket)).length;
            cells.push({ kind: 'value', percent: (retained / members.length) * 100 });
        }

        rows.push({ label: dateOf(new Date(cohortStart)), size: members.length, cells });
    }

    return ok('q_cohorts_practice', {
        columns: Array.from({ length: WEEK_COUNT }, (_, i) => `W${i}`),
        rows,
    });
}

/**
 * `q_retention_momenty` — недельные когорты устройств МОМЕНТОВ.
 *
 * Прежняя причина («у МОМЕНТОВ нет сервера — когорты удержания считать не из
 * чего») перестала быть правдой после потоков A/B/E: приёмник общий и
 * аутентифицированный, транспорт МОМЕНТОВ включён, события продукта попадают
 * в `AnalyticsEvent` с `product: 'moments'` и `deviceId` вместо аккаунта.
 * Оставлять её значило бы врать на панели учредителя.
 *
 * Считается по тому же смыслу, что и `q_cohorts_practice` рядом, но с двумя
 * сознательными отличиями:
 *
 *  1. Субъект — устройство (`deviceId`), а не пользователь: аккаунтов у
 *     МОМЕНТОВ в проде нет (`docs/PRIVACY-DPO.md §1` на стороне продукта).
 *  2. Неделя N отсчитывается от УСТАНОВКИ КАЖДОГО устройства, а не от
 *     календарной недели когорты. Иначе устройство, установившееся в
 *     четверг, получало бы «неделю 0» длиной в три дня, и доля возвратов
 *     занижалась бы тем сильнее, чем ближе к концу недели установка.
 *
 * Окно короче практикующего (4 когорты × 4 недели против 4 × 6): продукт
 * молодой, шесть недель истории у него просто не наберётся, а пустая
 * половина таблицы читается как поломка, хотя это возраст.
 */
const MOMENTY_COHORT_COUNT = 4;
const MOMENTY_WEEK_COUNT = 4;

export async function qRetentionMomenty(): Promise<PanelBlock<CohortsData>> {
    const now = Date.now();
    const oldestStart = now - (MOMENTY_COHORT_COUNT + MOMENTY_WEEK_COUNT - 1) * WEEK_MS;

    const installs = await db.analyticsEvent.findMany({
        where: {
            product: 'moments',
            event: 'app_installed',
            deviceId: { not: null },
            ts: { gte: new Date(oldestStart) },
        },
        select: { deviceId: true, ts: true },
    });

    if (installs.length === 0) {
        // Находка №2 (сверх аудита): тот же корень, что у q_momenty_nsm /
        // q_momenty_installs / q_momenty_d1/d7/d30 в products.ts — одна
        // причина на все карточки МОМЕНТОВ, а не своя формулировка на каждой.
        return noData('q_retention_momenty', MOMENTY_NOT_LAUNCHED_REASON);
    }

    // Первая установка на устройство: повтор app_installed (переустановка,
    // повтор доставки без event_id) не имеет права заводить вторую когорту.
    const installedAt = new Map<string, number>();
    for (const row of installs as { deviceId: string; ts: Date }[]) {
        const seen = installedAt.get(row.deviceId);
        if (seen === undefined || row.ts.getTime() < seen) installedAt.set(row.deviceId, row.ts.getTime());
    }

    const events = await db.analyticsEvent.findMany({
        where: {
            product: 'moments',
            deviceId: { in: [...installedAt.keys()] },
            ts: { gte: new Date(oldestStart) },
        },
        select: { deviceId: true, ts: true },
    });

    // Номер недели считаем от установки САМОГО устройства — см. §2 выше.
    const weeksSeen = new Map<string, Set<number>>();
    for (const row of events as { deviceId: string; ts: Date }[]) {
        const installTs = installedAt.get(row.deviceId);
        if (installTs === undefined) continue;
        const week = Math.floor((row.ts.getTime() - installTs) / WEEK_MS);
        if (week < 0) continue;
        const set = weeksSeen.get(row.deviceId) ?? new Set<number>();
        set.add(week);
        weeksSeen.set(row.deviceId, set);
    }

    const rows: CohortRow[] = [];
    for (let c = MOMENTY_COHORT_COUNT - 1; c >= 0; c -= 1) {
        const cohortStart = now - (c + MOMENTY_WEEK_COUNT - 1) * WEEK_MS;
        const cohortEnd = cohortStart + WEEK_MS;
        const members = [...installedAt.entries()].filter(([, ts]) => ts >= cohortStart && ts < cohortEnd);

        const cells: CohortCell[] = [];
        for (let w = 0; w < MOMENTY_WEEK_COUNT; w += 1) {
            if (members.length === 0) {
                cells.push({ kind: 'no_data', reason: 'в когорте нет ни одного устройства' });
                continue;
            }
            // Неделя недожита хотя бы у одного участника когорты — срок не
            // наступил. Это «рано», а не измеренный ноль: разница между
            // «ещё не вернулись» и «не вернулись» и есть весь смысл блока.
            const tooEarly = members.some(([, installTs]) => installTs + (w + 1) * WEEK_MS > now);
            if (tooEarly) {
                cells.push({ kind: 'too_early' });
                continue;
            }
            const retained = members.filter(([deviceId]) => weeksSeen.get(deviceId)?.has(w)).length;
            cells.push({ kind: 'value', percent: (retained / members.length) * 100 });
        }

        rows.push({ label: dateOf(new Date(cohortStart)), size: members.length, cells });
    }

    return ok('q_retention_momenty', {
        columns: Array.from({ length: MOMENTY_WEEK_COUNT }, (_, i) => `W${i}`),
        rows,
    });
}

export interface ChurnData {
    /** Число ушедших за 28 дней — это измеримо. */
    churned: number;
    base: number;
    ratePercent: number;
}

/**
 * `q_churn_reasons` — число ушедших есть, причины — нет.
 * Разделено на два блока намеренно: смешать их значило бы выдать
 * «причина неизвестна» за измеренную категорию.
 */
export async function qChurnCount(): Promise<PanelBlock<ChurnData>> {
    const since = new Date(Date.now() - 28 * DAY_MS);
    const [churned, base] = await Promise.all([
        db.subscription.count({ where: { status: 'churned', updatedAt: { gte: since } } }),
        db.subscription.count({ where: { startedAt: { lt: since } } }),
    ]);

    if (base === 0) {
        return noData('q_churn_count', 'на начало периода не было ни одной подписки');
    }

    return ok('q_churn_count', { churned, base, ratePercent: (churned / base) * 100 });
}

export async function qChurnReasons(): Promise<PanelBlock<never>> {
    return noData('q_churn_reasons', 'опроса при отмене подписки нет — причину ухода никто не спрашивает');
}
