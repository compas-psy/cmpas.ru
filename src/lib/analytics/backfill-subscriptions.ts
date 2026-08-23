// Обратное заполнение Subscription из истории Payment и полей User
// (charter/13_TRACKING_PLAN.md §5, задача B2). До B1 recordSubscriptionPayment
// вызывалась только за ANALYTICS_TRACKING_ENABLED (по умолчанию выключен),
// поэтому Subscription пуста или частично заполнена за то время, пока флаг
// был выключен — этот модуль восстанавливает по ней текущее состояние.
//
// Subscription хранит по одной строке на пользователя (@@unique([userId])) —
// это снимок ТЕКУЩЕГО состояния, не журнал истории. Значит восстанавливать
// нужно не всю цепочку платежей, а то же самое текущее состояние, которое
// уже держат User.subscriptionEndsAt/subscriptionPlan (источник правды для
// доступа) и Payment (источник правды для терминала/плана, когда User их не
// знает). "trial"/"grace" из User не восстановимы — на этих двух полях нет
// достаточно информации, поэтому backfill даёt только 'active' | 'churned'.
//
// Идемпотентность — не только про отсутствие дублей (upsert по userId и так
// не дублирует), а про то, чтобы НЕ трогать уже верные строки: Subscription
// имеет @updatedAt, а qRevenueChurn/qChurnCount (money.ts, retention.ts)
// считают "ушёл за последние 30 дней" по этому самому updatedAt. Слепой
// upsert на каждый прогон переписывал бы updatedAt даже когда ничего не
// изменилось и рисовал бы фантомный отток при каждом запуске backfill.
// Поэтому applyBackfill пишет только 'create' и 'update', пропуская 'skip'.

export interface BackfillUser {
    id: string;
    subscriptionEndsAt: Date | null;
    subscriptionPlan: string | null;
}

export interface BackfillPayment {
    userId: string;
    status: string; // 'pending' | 'paid' | 'failed' | 'cancelled'
    plan: string;
    terminal: string;
    createdAt: Date;
}

export interface ExistingSubscription {
    userId: string;
    plan: string;
    status: string;
    terminal: string;
    startedAt: Date;
    currentPeriodEnd: Date;
}

export type SubscriptionStatus = 'active' | 'churned';

export interface SubscriptionTarget {
    userId: string;
    plan: string;
    status: SubscriptionStatus;
    terminal: string;
    startedAt: Date;
    currentPeriodEnd: Date;
}

export type BackfillAction = 'create' | 'update' | 'skip';

export interface BackfillPlanItem {
    userId: string;
    action: BackfillAction;
    /** Отсутствует, когда пользователя пропускаем не из-за состояния строки, а из-за нехватки исходных данных. */
    target?: SubscriptionTarget;
    /** Причина skip — либо "уже верно", либо нехватка данных для восстановления. */
    reason: string;
}

function sameInstant(a: Date, b: Date): boolean {
    return a.getTime() === b.getTime();
}

function targetsEqual(a: ExistingSubscription, b: SubscriptionTarget): boolean {
    return (
        a.plan === b.plan &&
        a.status === b.status &&
        a.terminal === b.terminal &&
        sameInstant(a.startedAt, b.startedAt) &&
        sameInstant(a.currentPeriodEnd, b.currentPeriodEnd)
    );
}

/**
 * Чистая функция плана: по данным User/Payment/уже существующим строкам
 * Subscription решает, что создать, что поправить и что не трогать. Без
 * побочных эффектов — тестируется без базы (applyBackfill ниже делает
 * запись).
 */
export function computeSubscriptionBackfill(
    users: BackfillUser[],
    payments: BackfillPayment[],
    existing: ExistingSubscription[],
    now: Date = new Date(),
): BackfillPlanItem[] {
    const usersById = new Map(users.map((u) => [u.id, u]));
    const existingByUserId = new Map(existing.map((e) => [e.userId, e]));

    const paidByUser = new Map<string, BackfillPayment[]>();
    for (const p of payments) {
        if (p.status !== 'paid') continue;
        const list = paidByUser.get(p.userId) ?? [];
        list.push(p);
        paidByUser.set(p.userId, list);
    }
    for (const list of paidByUser.values()) {
        list.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    }

    // Кандидаты: у кого User помнит подписку, или у кого есть хоть один
    // оплаченный платёж — второе покрывает случай, когда сам User был
    // затем изменён/обнулён, а платёжная история всё ещё свидетельствует
    // о подписке.
    const candidateIds = new Set<string>();
    for (const u of users) {
        if (u.subscriptionEndsAt) candidateIds.add(u.id);
    }
    for (const userId of paidByUser.keys()) candidateIds.add(userId);

    const plan: BackfillPlanItem[] = [];

    for (const userId of candidateIds) {
        const user = usersById.get(userId);
        const paid = paidByUser.get(userId) ?? [];
        const lastPaid = paid[paid.length - 1];
        const firstPaid = paid[0];

        const currentPeriodEnd = user?.subscriptionEndsAt ?? lastPaid?.createdAt ?? null;
        if (!currentPeriodEnd) {
            plan.push({ userId, action: 'skip', reason: 'нет ни subscriptionEndsAt, ни оплаченных платежей — восстанавливать не из чего' });
            continue;
        }

        const subscriptionPlan = user?.subscriptionPlan ?? lastPaid?.plan ?? null;
        if (!subscriptionPlan) {
            plan.push({ userId, action: 'skip', reason: 'план не определить: ни User.subscriptionPlan, ни один оплаченный платёж его не называют' });
            continue;
        }

        const target: SubscriptionTarget = {
            userId,
            plan: subscriptionPlan,
            status: currentPeriodEnd > now ? 'active' : 'churned',
            terminal: lastPaid?.terminal ?? 'site',
            // Лучшее известное приближение: с какого момента человек платит.
            // Платёж есть не всегда (User.subscriptionEndsAt мог быть
            // проставлен без сохранившейся истории Payment) — тогда честнее
            // взять currentPeriodEnd, чем придумывать дату.
            startedAt: firstPaid?.createdAt ?? currentPeriodEnd,
            currentPeriodEnd,
        };

        const existingRow = existingByUserId.get(userId);
        if (!existingRow) {
            plan.push({ userId, action: 'create', target, reason: 'строки Subscription нет — создаём из User/Payment' });
        } else if (targetsEqual(existingRow, target)) {
            plan.push({ userId, action: 'skip', target, reason: 'уже верно — не трогаем (в т.ч. чтобы не переписать updatedAt)' });
        } else {
            plan.push({ userId, action: 'update', target, reason: 'строка расходится с User/Payment — поправляем' });
        }
    }

    return plan;
}

type Db = {
    subscription: {
        create: (args: { data: SubscriptionTarget }) => Promise<unknown>;
        update: (args: { where: { userId: string }; data: Omit<SubscriptionTarget, 'userId'> }) => Promise<unknown>;
    };
};

export interface ApplyResult {
    created: number;
    updated: number;
    skipped: number;
}

/** Исполняет план: create/update только для соответствующих action, skip не трогает базу вовсе. */
export async function applyBackfill(db: Db, plan: BackfillPlanItem[]): Promise<ApplyResult> {
    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (const item of plan) {
        if (item.action === 'skip') {
            skipped += 1;
            continue;
        }
        if (!item.target) continue; // не должно случаться — create/update всегда несут target

        if (item.action === 'create') {
            await db.subscription.create({ data: item.target });
            created += 1;
        } else {
            const { userId, ...data } = item.target;
            await db.subscription.update({ where: { userId }, data });
            updated += 1;
        }
    }

    return { created, updated, skipped };
}
