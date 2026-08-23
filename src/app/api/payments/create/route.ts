import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { initPayment, PLANS, PlanKey } from '@/lib/tinkoff';
import { track } from '@/lib/analytics/track';
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

    // B4: payment_initiated — платёжная сессия у банка реально создана
    // (result.success), человек сейчас пойдёт на paymentUrl. Раньше этого
    // момента событию быть нечем: Payment.status ещё 'pending' до колбэка.
    await track(db, {
        event: 'payment_initiated',
        product: 'practice',
        accountId: session.user.id,
        props: { terminal: payment.terminal, plan, amount, months },
    });

    return NextResponse.json({ paymentUrl: result.paymentUrl });
}
