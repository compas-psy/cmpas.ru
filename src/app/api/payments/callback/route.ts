import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyNotificationToken, resolveTerminal, TinkoffNotification } from '@/lib/tinkoff';
import { recordSubscriptionPayment } from '@/lib/analytics/subscription';
import { track } from '@/lib/analytics/track';

function parseBody(body: string, contentType: string): Record<string, unknown> {
    // Tinkoff sends application/x-www-form-urlencoded (sometimes JSON)
    if (contentType.includes('application/json')) {
        return JSON.parse(body);
    }
    // URL-encoded form data
    const params: Record<string, unknown> = {};
    for (const [k, v] of new URLSearchParams(body).entries()) {
        if (v === 'true') params[k] = true;
        else if (v === 'false') params[k] = false;
        else if (/^\d+$/.test(v)) params[k] = Number(v);
        else params[k] = v;
    }
    return params;
}

export async function POST(request: NextRequest) {
    const bodyText = await request.text();
    const contentType = request.headers.get('content-type') || '';

    let notification: TinkoffNotification;
    try {
        notification = parseBody(bodyText, contentType) as TinkoffNotification;
    } catch {
        return new NextResponse('Bad Request', { status: 400 });
    }

    console.log('[Tinkoff callback]', JSON.stringify(notification));

    // Verify token
    if (!verifyNotificationToken(notification)) {
        console.error('[Tinkoff callback] Invalid token, OrderId:', notification.OrderId);
        return new NextResponse('Invalid token', { status: 400 });
    }

    const { OrderId, Status, PaymentId, Amount, RebillId } = notification;
    const terminalConfig = resolveTerminal(notification.TerminalKey);

    // Find payment
    const payment = await db.payment.findUnique({ where: { orderId: String(OrderId) } });
    if (!payment) {
        console.error('[Tinkoff callback] Payment not found:', OrderId);
        return new NextResponse('OK'); // Return OK to stop Tinkoff retries
    }

    const statusMap: Record<string, string> = {
        CONFIRMED: 'paid',
        AUTHORIZED: 'paid',
        REJECTED: 'failed',
        REVERSED: 'cancelled',
        REFUNDED: 'cancelled',
        PARTIAL_REFUNDED: 'cancelled',
        DEADLINE_EXPIRED: 'failed',
        CANCELED: 'cancelled',
    };
    const newStatus = statusMap[Status] ?? payment.status;

    // Update payment record
    await db.payment.update({
        where: { orderId: String(OrderId) },
        data: {
            status: newStatus,
            tinkoffPaymentId: String(PaymentId),
            ...(terminalConfig ? { terminal: terminalConfig.terminal } : {}),
            ...(RebillId ? { rebillId: String(RebillId) } : {}),
        },
    });

    const terminal = terminalConfig?.terminal ?? payment.terminal;

    // Activate subscription on successful payment
    if (newStatus === 'paid' && payment.status !== 'paid') {
        const activatedAt = new Date();
        const user = await db.user.findUnique({
            where: { id: payment.userId },
            select: { subscriptionEndsAt: true },
        });

        // Уже была активная подписка на момент этого платежа — продление,
        // а не первый вход/возврат после отвала. Считаем один раз здесь и
        // переиспользуем и для даты, и для выбора события ниже — второй
        // отдельный `new Date()` через несколько строк мог бы разойтись с
        // этим на миллисекунды и дать другой ответ на «была ли активна».
        const wasActive = Boolean(user?.subscriptionEndsAt && user.subscriptionEndsAt > activatedAt);

        // Extend from current end (or from now if expired/no subscription)
        const base = wasActive ? (user!.subscriptionEndsAt as Date) : activatedAt;

        const subscriptionEndsAt = new Date(base);
        subscriptionEndsAt.setMonth(subscriptionEndsAt.getMonth() + payment.months);

        await db.user.update({
            where: { id: payment.userId },
            data: { subscriptionEndsAt, subscriptionPlan: payment.plan },
        });

        console.log(`[Tinkoff] Subscription activated: user=${payment.userId}, until=${subscriptionEndsAt.toISOString()}, rebillId=${RebillId}`);

        // Учётная запись о деньгах (charter/13_TRACKING_PLAN.md §5) — не
        // поведенческая аналитика, поэтому не за ANALYTICS_TRACKING_ENABLED
        // (тот флаг — для событий в POST /ingest, см.
        // src/lib/analytics/flags.ts). Раньше запись Subscription была за
        // этим флагом, который по умолчанию выключен, — таблица не
        // заполнялась вовсе, и панель считала выручку/удержание по пустой
        // Subscription. recordSubscriptionPayment сам не пишет rebillId и
        // пароль терминала (см. её сигнатуру) — рубеж §5 держит она, не
        // условие здесь.
        await recordSubscriptionPayment(db, {
            userId: payment.userId,
            plan: payment.plan,
            months: payment.months,
            terminal,
        });

        // B4: payment_succeeded — сам факт успешного платежа, здесь же, а
        // не в /create (там платёж только начат, не подтверждён банком).
        await track(db, {
            event: 'payment_succeeded',
            product: 'practice',
            accountId: payment.userId,
            props: { terminal, plan: payment.plan, amount: payment.amount, months: payment.months },
        });

        // subscription_started/renewed — тот же выбор, что определяет
        // "продлеваем от текущего конца или начинаем от сейчас" выше
        // (wasActive), просто отражённый в событии для воронки.
        await track(db, {
            event: wasActive ? 'subscription_renewed' : 'subscription_started',
            product: 'practice',
            accountId: payment.userId,
            props: { terminal, plan: payment.plan, months: payment.months },
        });
    }

    // payment_failed — банк отклонил или просрочил платёж. Гвард по смене
    // статуса (как и для paid выше) — тот же вебхук Tinkoff может прийти
    // повторно для уже обработанного платежа, событие не должно дублироваться.
    if (newStatus === 'failed' && payment.status !== 'failed') {
        await track(db, {
            event: 'payment_failed',
            product: 'practice',
            accountId: payment.userId,
            props: { terminal, plan: payment.plan, reason: Status },
        });
    }

    // subscription_churned — интерпретация, зафиксированная явно: у нас нет
    // задачи, которая бы отслеживала истечение подписки без продления
    // (естественный отток), поэтому единственная реальная точка, где
    // "отток по деньгам" фактически происходит в этом коде — банк
    // разворачивает/возвращает уже прошедший платёж (REVERSED/REFUNDED/
    // PARTIAL_REFUNDED/CANCELED из statusMap выше → newStatus 'cancelled').
    // Это не покрывает истечение по неоплате — см. отчёт по задаче B4.
    if (newStatus === 'cancelled' && payment.status === 'paid') {
        await track(db, {
            event: 'subscription_churned',
            product: 'practice',
            accountId: payment.userId,
            props: { terminal, plan: payment.plan, months: payment.months },
        });
    }

    // Tinkoff requires plain text "OK" response
    return new NextResponse('OK');
}
