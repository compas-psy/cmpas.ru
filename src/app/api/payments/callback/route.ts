import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyNotificationToken, TinkoffNotification } from '@/lib/tinkoff';

export async function POST(request: NextRequest) {
    let notification: TinkoffNotification;
    try {
        notification = await request.json();
    } catch {
        return new NextResponse('Bad Request', { status: 400 });
    }

    console.log('[Tinkoff callback]', JSON.stringify(notification));

    // Verify token
    if (!verifyNotificationToken(notification)) {
        console.error('[Tinkoff callback] Invalid token!', notification.OrderId);
        return new NextResponse('Invalid token', { status: 400 });
    }

    const { OrderId, Status, PaymentId, Amount } = notification;

    // Find payment
    const payment = await db.payment.findUnique({ where: { orderId: OrderId } });
    if (!payment) {
        console.error('[Tinkoff callback] Payment not found:', OrderId);
        return new NextResponse('OK'); // Return OK to stop retries
    }

    // Map Tinkoff status to our status
    const statusMap: Record<string, string> = {
        CONFIRMED: 'paid',
        AUTHORIZED: 'paid',
        REJECTED: 'failed',
        REVERSED: 'cancelled',
        REFUNDED: 'cancelled',
    };
    const newStatus = statusMap[Status] ?? payment.status;

    // Update payment
    await db.payment.update({
        where: { orderId: OrderId },
        data: {
            status: newStatus,
            tinkoffPaymentId: String(PaymentId),
        },
    });

    // On successful payment — activate subscription
    if (newStatus === 'paid' && payment.status !== 'paid') {
        const user = await db.user.findUnique({
            where: { id: payment.userId },
            select: { subscriptionEndsAt: true },
        });

        // Extend from current subscription end (or now if expired)
        const base = user?.subscriptionEndsAt && user.subscriptionEndsAt > new Date()
            ? user.subscriptionEndsAt
            : new Date();

        const subscriptionEndsAt = new Date(base);
        subscriptionEndsAt.setMonth(subscriptionEndsAt.getMonth() + payment.months);

        await db.user.update({
            where: { id: payment.userId },
            data: {
                subscriptionEndsAt,
                subscriptionPlan: payment.plan,
            },
        });

        console.log(`[Tinkoff callback] Subscription activated for user ${payment.userId} until ${subscriptionEndsAt.toISOString()}`);
    }

    // Tinkoff expects plain "OK" response
    return new NextResponse('OK');
}
