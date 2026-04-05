import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { initPayment, PLANS, PlanKey } from '@/lib/tinkoff';
import { randomBytes } from 'crypto';

const APP_URL = process.env.AUTH_URL || 'https://cmpas.ru';

export async function POST(request: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { plan, months = 1 } = await request.json();

    if (!plan || !PLANS[plan as PlanKey]) {
        return NextResponse.json({ error: 'Invalid plan' }, { status: 400 });
    }

    const planData = PLANS[plan as PlanKey];
    const amount = planData.price * months;
    const orderId = `cmpas_${session.user.id}_${randomBytes(8).toString('hex')}`;

    // Create Payment record
    const payment = await db.payment.create({
        data: {
            userId: session.user.id,
            orderId,
            amount,
            plan,
            months,
            status: 'pending',
        },
    });

    // Init Tinkoff payment
    const result = await initPayment({
        orderId,
        amount,
        description: `${planData.description}${months > 1 ? ` (${months} мес.)` : ''}`,
        customerKey: session.user.id,
        successUrl: `${APP_URL}/billing/success?orderId=${orderId}`,
        failUrl: `${APP_URL}/billing?error=payment_failed`,
        notificationUrl: `${APP_URL}/api/payments/callback`,
    });

    if (!result.success || !result.paymentUrl) {
        await db.payment.update({
            where: { id: payment.id },
            data: { status: 'failed' },
        });
        return NextResponse.json({ error: result.errorMessage || 'Ошибка создания платежа' }, { status: 500 });
    }

    // Save Tinkoff payment ID and URL
    await db.payment.update({
        where: { id: payment.id },
        data: {
            tinkoffPaymentId: result.paymentId,
            paymentUrl: result.paymentUrl,
        },
    });

    return NextResponse.json({ paymentUrl: result.paymentUrl });
}
