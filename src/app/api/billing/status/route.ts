import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { readBillingStatus, EMPTY_BILLING_STATUS } from '@/lib/billing/status';

/**
 * Состояние оплаты для веб-кабинета.
 *
 * Само правило — в `src/lib/billing/status.ts`: им пользуется и приложение.
 * Два вычисления «активна ли подписка» в двух местах рано или поздно
 * разойдутся, и разойдутся молча.
 */
export async function GET() {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    try {
        return NextResponse.json(await readBillingStatus(session.user.id));
    } catch {
        return NextResponse.json(EMPTY_BILLING_STATUS);
    }
}
