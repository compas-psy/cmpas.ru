/**
 * Экран 2 — «Деньги». Считается по `Subscription` и `Payment`.
 * Суммы в базе лежат в копейках; наружу отдаются копейки, форматирование —
 * дело разметки.
 */

import { db } from '@/lib/db';
import { noData, ok, type PanelBlock } from '../types';
import { deltaAbs, deltaPercent, deltaPoints, monthOf, type Delta } from '../format';

const DAY_MS = 24 * 60 * 60 * 1000;

function monthStart(offset: number): Date {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - offset, 1));
}

export interface MrrMonthly {
    /** 12 месяцев от старого к новому. `value` в копейках. */
    months: { label: string; value: number | null }[];
    current: number;
    previous: number;
    delta: Delta;
}

/**
 * `q_mrr_monthly` — выручка по месяцам, одна серия и одна ось.
 * Берём фактически оплаченные платежи: подписка без оплаты выручкой не является.
 */
export async function qMrrMonthly(): Promise<PanelBlock<MrrMonthly>> {
    const from = monthStart(11);
    const rows = await db.payment.findMany({
        where: { status: 'paid', createdAt: { gte: from } },
        select: { amount: true, createdAt: true, months: true },
    });

    if (rows.length === 0) {
        // Раньше здесь безусловно строились 12 бакетов по нулю и уходили как
        // ok — неотличимо на экране от «выручка правда упала до нуля». Ни
        // одного оплаченного платежа за год — это отсутствие данных, а не
        // измеренный ноль (ТЗ §4: no_data никогда не рисуется нулём).
        return noData('q_mrr_monthly', 'за 12 месяцев нет ни одного оплаченного платежа — выручку считать не из чего');
    }

    const buckets = new Map<string, number>();
    for (let i = 11; i >= 0; i -= 1) buckets.set(monthStart(i).toISOString(), 0);

    for (const row of rows) {
        const key = new Date(Date.UTC(row.createdAt.getUTCFullYear(), row.createdAt.getUTCMonth(), 1)).toISOString();
        if (!buckets.has(key)) continue;
        // Платёж за N месяцев — это выручка, размазанная на N месяцев:
        // иначе годовая оплата даёт фальшивый пик MRR.
        buckets.set(key, (buckets.get(key) ?? 0) + Math.round(row.amount / Math.max(1, row.months)));
    }

    const months = [...buckets.entries()].map(([iso, value]) => ({ label: monthOf(iso), value }));
    const current = months[months.length - 1]?.value ?? 0;
    const previous = months[months.length - 2]?.value ?? 0;

    return ok('q_mrr_monthly', { months, current, previous, delta: deltaPercent(current, previous, true) });
}

export interface PayingUsers {
    active: number;
    previous: number;
    delta: Delta;
    trial: number;
    grace: number;
}

export async function qPayingUsers(): Promise<PanelBlock<PayingUsers>> {
    // Единственный блок «Денег», который читает ИСКЛЮЧИТЕЛЬНО Subscription
    // (не Payment) и раньше не проверял, есть ли там вообще что читать —
    // ok с active:0/trial:0/grace:0 приходил и тогда, когда Subscription
    // была просто пуста (B1: запись раньше была за выключенным флагом), и
    // тогда, когда платящих правда не было. Это два разных факта, и первый
    // — no_data (ТЗ §4), а не ложный ноль.
    //
    // Subscription — намеренно источник для этого блока (её собственный
    // топ-комментарий: «kept separate from the Payment/subscriptionEndsAt
    // logic — mirrors state for measurement»), а не User/Payment: только в
    // Subscription.status живёт различение active/trial/grace, которого на
    // User нет вовсе. После B1 (пишет каждый платёж) и B2 (бэкафилл
    // истории) эта таблица достоверна; guard здесь — по-прежнему нужная
    // защита на случай, если backfill ещё не запускали.
    const total = await db.subscription.count();
    if (total === 0) {
        return noData('q_paying_users', 'таблица Subscription пуста — обратное заполнение из Payment/User ещё не выполнено (scripts/backfill-subscriptions.ts)');
    }

    const monthAgo = new Date(Date.now() - 30 * DAY_MS);
    const [active, trial, grace, startedThisMonth, churnedThisMonth] = await Promise.all([
        db.subscription.count({ where: { status: 'active' } }),
        db.subscription.count({ where: { status: 'trial' } }),
        db.subscription.count({ where: { status: 'grace' } }),
        db.subscription.count({ where: { status: 'active', startedAt: { gte: monthAgo } } }),
        db.subscription.count({ where: { status: 'churned', updatedAt: { gte: monthAgo } } }),
    ]);

    const previous = active - startedThisMonth + churnedThisMonth;
    return ok('q_paying_users', { active, previous, delta: deltaAbs(active, previous, true), trial, grace });
}

export interface Arpu {
    /** Копейки на одного платящего за 30 дней. */
    value: number;
    previous: number;
    delta: Delta;
    payers: number;
}

export async function qArpu(): Promise<PanelBlock<Arpu>> {
    const now = Date.now();
    const window = async (fromDays: number, toDays: number) => {
        const rows = await db.payment.findMany({
            where: { status: 'paid', createdAt: { gte: new Date(now - fromDays * DAY_MS), lt: new Date(now - toDays * DAY_MS) } },
            select: { amount: true, userId: true, months: true },
        });
        const payers = new Set(rows.map((r) => r.userId));
        const sum = rows.reduce((acc, r) => acc + Math.round(r.amount / Math.max(1, r.months)), 0);
        return { sum, payers: payers.size };
    };

    const [current, previous] = await Promise.all([window(30, 0), window(60, 30)]);

    if (current.payers === 0) {
        return noData('q_arpu', 'за 30 дней не было ни одного оплаченного платежа — средний чек считать не из чего');
    }

    const value = Math.round(current.sum / current.payers);
    const prev = previous.payers > 0 ? Math.round(previous.sum / previous.payers) : 0;
    return ok('q_arpu', { value, previous: prev, delta: deltaPercent(value, prev, true), payers: current.payers });
}

export interface TrialConversion {
    rate: number;
    previous: number;
    delta: Delta;
    converted: number;
    cohort: number;
}

/**
 * `q_trial_conversion` — доля триалов, дошедших до оплаты.
 * Когорта: подписки, начавшиеся 30–60 дней назад, — у них триал уже кончился.
 */
export async function qTrialConversion(): Promise<PanelBlock<TrialConversion>> {
    const now = Date.now();
    const measure = async (fromDays: number, toDays: number) => {
        const range = { gte: new Date(now - fromDays * DAY_MS), lt: new Date(now - toDays * DAY_MS) };
        const [cohort, converted] = await Promise.all([
            db.subscription.count({ where: { startedAt: range } }),
            db.subscription.count({ where: { startedAt: range, status: { in: ['active', 'grace'] } } }),
        ]);
        return { cohort, converted };
    };

    const [current, previous] = await Promise.all([measure(60, 30), measure(90, 60)]);

    if (current.cohort === 0) {
        return noData('q_trial_conversion', 'в когорте 30–60 дней назад нет ни одного триала — доли считать не из чего');
    }

    const rate = (current.converted / current.cohort) * 100;
    const prev = previous.cohort > 0 ? (previous.converted / previous.cohort) * 100 : 0;

    return ok('q_trial_conversion', {
        rate,
        previous: prev,
        delta: deltaPoints(rate, prev, true),
        converted: current.converted,
        cohort: current.cohort,
    });
}

export interface RevenueChurn {
    rate: number;
    previous: number;
    delta: Delta;
    churned: number;
    base: number;
}

export async function qRevenueChurn(): Promise<PanelBlock<RevenueChurn>> {
    const now = Date.now();
    const measure = async (fromDays: number, toDays: number) => {
        const range = { gte: new Date(now - fromDays * DAY_MS), lt: new Date(now - toDays * DAY_MS) };
        const [churned, base] = await Promise.all([
            db.subscription.count({ where: { status: 'churned', updatedAt: range } }),
            db.subscription.count({ where: { startedAt: { lt: new Date(now - toDays * DAY_MS) } } }),
        ]);
        return { churned, base };
    };

    const [current, previous] = await Promise.all([measure(30, 0), measure(60, 30)]);
    if (current.base === 0) {
        return noData('q_revenue_churn', 'на начало периода не было ни одной подписки — оттоку не от чего считаться');
    }

    const rate = (current.churned / current.base) * 100;
    const prev = previous.base > 0 ? (previous.churned / previous.base) * 100 : 0;

    // Отток — тот случай, где падение это «лучше».
    return ok('q_revenue_churn', {
        rate,
        previous: prev,
        delta: deltaPoints(rate, prev, false),
        churned: current.churned,
        base: current.base,
    });
}

/**
 * Окно денежных блоков, читающих `Payment` напрямую (не через `Subscription`).
 *
 * Было суточным — с девятью платежами за всю историю проекта сутки почти
 * всегда пусты, и блок был `no_data` не потому что списаний нет, а потому
 * что окно уже, чем интервал между ними. Соседние блоки этого экрана
 * (`q_arpu`, `q_trial_conversion`) уже считают тридцатидневными окнами —
 * приводим сюда, вместо того чтобы придумывать третье число. Общая
 * константа не только документирует выбор, но и физически не даёт двум
 * блокам разойтись на разные окна снова (как разошлись `q_lamp_reminders`
 * и `q_practice_reminders` — см. tests/panel-reminders-source-agreement.test.ts):
 * `q_lamp_money` (morning.ts) и коллектор `webhook-error-rate.ts` (тот же
 * платёжный вопрос под другим углом) обязаны использовать то же число дней.
 */
export const PAYMENTS_WINDOW_DAYS = 30;

export interface PaymentsDaily {
    rate: number;
    paid: number;
    total: number;
    windowDays: number;
    /** Разбивка по терминалам: сайт и приложение считаются отдельно. */
    terminals: { terminal: string; rate: number; paid: number; total: number }[];
}

export async function qPaymentsDaily(): Promise<PanelBlock<PaymentsDaily>> {
    const since = new Date(Date.now() - PAYMENTS_WINDOW_DAYS * DAY_MS);
    const rows = await db.payment.groupBy({
        by: ['terminal', 'status'],
        where: { createdAt: { gte: since } },
        _count: { _all: true },
    });

    const total = rows.reduce((acc, r) => acc + r._count._all, 0);
    if (total === 0) {
        return noData('q_payments_daily', `за ${PAYMENTS_WINDOW_DAYS} дней не было ни одной попытки списания`);
    }

    const paid = rows.filter((r) => r.status === 'paid').reduce((acc, r) => acc + r._count._all, 0);

    const byTerminal = new Map<string, { paid: number; total: number }>();
    for (const row of rows) {
        const entry = byTerminal.get(row.terminal) ?? { paid: 0, total: 0 };
        entry.total += row._count._all;
        if (row.status === 'paid') entry.paid += row._count._all;
        byTerminal.set(row.terminal, entry);
    }

    return ok('q_payments_daily', {
        rate: (paid / total) * 100,
        paid,
        total,
        windowDays: PAYMENTS_WINDOW_DAYS,
        terminals: [...byTerminal.entries()].map(([terminal, v]) => ({
            terminal,
            rate: v.total > 0 ? (v.paid / v.total) * 100 : 0,
            paid: v.paid,
            total: v.total,
        })),
    });
}

export interface MrrWaterfall {
    /** Копейки. Прирост положительный, потеря отрицательная. */
    newRevenue: number;
    expansion: number;
    contraction: number;
    churn: number;
    net: number;
}

/**
 * `q_mrr_waterfall` — из чего сложилось изменение MRR за 30 дней.
 * Расширение и сжатие считаются по смене тарифа: сегодняшний план против
 * плана, за который человек платил в предыдущем периоде.
 */
export async function qMrrWaterfall(): Promise<PanelBlock<MrrWaterfall>> {
    const now = Date.now();
    const periodStart = new Date(now - 30 * DAY_MS);
    const prevStart = new Date(now - 60 * DAY_MS);

    const [fresh, churned, recent, earlier] = await Promise.all([
        db.payment.findMany({
            where: { status: 'paid', createdAt: { gte: periodStart } },
            select: { amount: true, months: true, userId: true },
        }),
        db.subscription.findMany({
            where: { status: 'churned', updatedAt: { gte: periodStart } },
            select: { userId: true },
        }),
        db.payment.findMany({
            where: { status: 'paid', createdAt: { gte: periodStart } },
            select: { userId: true, amount: true, months: true },
        }),
        db.payment.findMany({
            where: { status: 'paid', createdAt: { gte: prevStart, lt: periodStart } },
            select: { userId: true, amount: true, months: true },
        }),
    ]);

    if (fresh.length === 0 && earlier.length === 0 && churned.length === 0) {
        return noData('q_mrr_waterfall', 'за два последних периода нет ни одного оплаченного платежа');
    }

    const mrrOf = (rows: { userId: string; amount: number; months: number }[]) => {
        const map = new Map<string, number>();
        for (const r of rows) map.set(r.userId, (map.get(r.userId) ?? 0) + Math.round(r.amount / Math.max(1, r.months)));
        return map;
    };

    const nowMap = mrrOf(recent);
    const prevMap = mrrOf(earlier);

    let newRevenue = 0;
    let expansion = 0;
    let contraction = 0;
    for (const [userId, value] of nowMap) {
        const before = prevMap.get(userId);
        if (before === undefined) newRevenue += value;
        else if (value > before) expansion += value - before;
        else if (value < before) contraction += before - value;
    }

    let churnLoss = 0;
    for (const [userId, before] of prevMap) {
        if (!nowMap.has(userId)) churnLoss += before;
    }

    return ok('q_mrr_waterfall', {
        newRevenue,
        expansion,
        contraction: -contraction,
        churn: -churnLoss,
        net: newRevenue + expansion - contraction - churnLoss,
    });
}

export interface FailedQueue {
    count: number;
    /** Копейки, ждущие повтора. */
    amount: number;
    /** Самый старый висящий платёж — он и есть настоящая проблема. */
    oldestAt: string | null;
    olderThan30d: number;
}

export async function qPaymentsFailedQueue(): Promise<PanelBlock<FailedQueue>> {
    const rows = await db.payment.findMany({
        where: { status: { in: ['failed', 'pending'] } },
        select: { amount: true, createdAt: true },
        orderBy: { createdAt: 'asc' },
    });

    const cutoff = Date.now() - 30 * DAY_MS;
    return ok('q_payments_failed_queue', {
        count: rows.length,
        amount: rows.reduce((acc, r) => acc + r.amount, 0),
        oldestAt: rows[0]?.createdAt.toISOString() ?? null,
        olderThan30d: rows.filter((r) => r.createdAt.getTime() < cutoff).length,
    });
}
