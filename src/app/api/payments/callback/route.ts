import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyNotificationToken, TinkoffNotification } from '@/lib/tinkoff';

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
            ...(RebillId ? { rebillId: String(RebillId) } : {}),
        },
    });

    // Activate subscription on successful payment
    if (newStatus === 'paid' && payment.status !== 'paid') {
        const user = await db.user.findUnique({
            where: { id: payment.userId },
            select: { subscriptionEndsAt: true },
        });

        // Extend from current end (or from now if expired/no subscription)
        const base = user?.subscriptionEndsAt && user.subscriptionEndsAt > new Date()
            ? user.subscriptionEndsAt
            : new Date();

        const subscriptionEndsAt = new Date(base);
        subscriptionEndsAt.setMonth(subscriptionEndsAt.getMonth() + payment.months);

        await db.user.update({
            where: { id: payment.userId },
            data: { subscriptionEndsAt, subscriptionPlan: payment.plan },
        });

        console.log(`[Tinkoff] Subscription activated: user=${payment.userId}, until=${subscriptionEndsAt.toISOString()}, rebillId=${RebillId}`);
    }

    // Tinkoff requires plain text "OK" response
    return new NextResponse('OK');
}
