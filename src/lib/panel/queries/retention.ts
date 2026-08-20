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
}

const COHORT_COUNT = 4;
const WEEK_COUNT = 6;

/**
 * `q_cohorts_practice` — недельные когорты специалистов.
 * Когорта — все, кто зарегистрировался на одной неделе; удержание на неделе N —
 * доля из них, у кого на этой неделе была хоть одна сессия.
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
        return noData('q_cohorts_practice', 'за окно наблюдения не зарегистрировался ни один специалист');
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

/** Удержание МОМЕНТОВ — сервера нет, событий об использовании тоже. */
export async function qRetentionMomenty(): Promise<PanelBlock<never>> {
    return noData('q_retention_momenty', 'у МОМЕНТОВ нет сервера — когорты удержания считать не из чего');
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
