// Обратное заполнение Subscription из истории Payment и полей User
// (charter/13_TRACKING_PLAN.md §5, задача B2). Логика — чистая функция в
// src/lib/analytics/backfill-subscriptions.ts (тесты — там же, без базы);
// этот файл — тонкая обвязка ввода/вывода поверх настоящего PrismaClient,
// по образцу scripts/reconcile-tinkoff.ts.
//
// Идемпотентен: повторный запуск не создаёт дублей (Subscription.userId
// уникален) и не трогает уже верные строки (см. комментарий в
// backfill-subscriptions.ts про updatedAt).
//
// Usage:
//   npx tsx scripts/backfill-subscriptions.ts            — применяет план
//   npx tsx scripts/backfill-subscriptions.ts --dry-run   — только печатает план, ничего не пишет

import { PrismaClient } from '@prisma/client';
import { computeSubscriptionBackfill, applyBackfill } from '../src/lib/analytics/backfill-subscriptions';

const db = new PrismaClient();

async function main() {
    const dryRun = process.argv.includes('--dry-run');

    const [users, payments, existing] = await Promise.all([
        db.user.findMany({
            where: { subscriptionEndsAt: { not: null } },
            select: { id: true, subscriptionEndsAt: true, subscriptionPlan: true },
        }),
        db.payment.findMany({
            where: { status: 'paid' },
            select: { userId: true, status: true, plan: true, terminal: true, createdAt: true },
        }),
        db.subscription.findMany({
            select: { userId: true, plan: true, status: true, terminal: true, startedAt: true, currentPeriodEnd: true },
        }),
    ]);

    // computeSubscriptionBackfill сама добирает кандидатов и по Payment
    // (пользователь мог быть оплачен, но затем User.subscriptionEndsAt
    // обнулён) — поэтому пользователей с payments, но без
    // subscriptionEndsAt, тоже нужно передать: собираем их id отдельно.
    const paidUserIds = new Set(payments.map((p) => p.userId));
    const knownUserIds = new Set(users.map((u) => u.id));
    const missingUserIds = [...paidUserIds].filter((id) => !knownUserIds.has(id));
    const extraUsers = missingUserIds.length
        ? await db.user.findMany({
              where: { id: { in: missingUserIds } },
              select: { id: true, subscriptionEndsAt: true, subscriptionPlan: true },
          })
        : [];

    const plan = computeSubscriptionBackfill([...users, ...extraUsers], payments, existing, new Date());

    const byAction = { create: 0, update: 0, skip: 0 };
    for (const item of plan) byAction[item.action] += 1;
    console.log(`[backfill-subscriptions] план: create=${byAction.create} update=${byAction.update} skip=${byAction.skip}`);

    const skippedForMissingData = plan.filter((p) => p.action === 'skip' && !p.target);
    if (skippedForMissingData.length) {
        console.warn(`[backfill-subscriptions] ${skippedForMissingData.length} пользователей пропущены из-за нехватки данных:`);
        for (const item of skippedForMissingData) {
            console.warn(`  userId=${item.userId}: ${item.reason}`);
        }
    }

    if (dryRun) {
        console.log('[backfill-subscriptions] --dry-run: запись в базу не выполняется');
        for (const item of plan) {
            if (item.action !== 'skip') console.log(`  ${item.action} userId=${item.userId}:`, item.target);
        }
        return;
    }

    const result = await applyBackfill(db, plan);
    console.log('[backfill-subscriptions] выполнено:', result);
}

main()
    .catch((e) => {
        console.error(e);
        process.exitCode = 1;
    })
    .finally(() => db.$disconnect());
