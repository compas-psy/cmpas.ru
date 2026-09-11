import { NextRequest, NextResponse } from 'next/server';
import { authenticateMobileRequest, unauthorizedResponse } from '@/lib/mobile-auth';
import { readBillingStatus, EMPTY_BILLING_STATUS } from '@/lib/billing/status';
import { PRACTICE_PRICE_LABEL } from '@/lib/billing/pricing';

/**
 * GET /api/mobile/billing — состояние оплаты для приложения.
 *
 * В настройках приложения не было ни строчки о том, оплачено ли что-нибудь:
 * человек видел разделы практики и не видел, сколько ему осталось пробного
 * периода и когда кончится подписка. Узнать это можно было только из
 * веб-кабинета — то есть через другое устройство или браузер.
 *
 * Вывод «активна» считает сервер (src/lib/billing/status.ts), а не экран:
 * ровно тем же кодом, что и для веба.
 *
 * Оплата остаётся на веб-странице, и приложение честно ведёт туда ссылкой.
 * Своего платёжного окна у приложения нет: платёж — это возврат от банка на
 * страницу, и повторять этот путь внутри приложения значило бы завести
 * второй, который некому проверять.
 */
export async function GET(req: NextRequest) {
    const auth = await authenticateMobileRequest(req);
    if (!auth) return unauthorizedResponse();

    const appUrl = process.env.AUTH_URL || process.env.NEXTAUTH_URL || 'https://cmpas.ru';

    try {
        const status = await readBillingStatus(auth.userId);
        return NextResponse.json({
            ...status,
            priceLabel: PRACTICE_PRICE_LABEL,
            payUrl: `${appUrl}/billing`,
        });
    } catch (error) {
        console.error('[mobile/billing]', error);
        return NextResponse.json({ ...EMPTY_BILLING_STATUS, priceLabel: PRACTICE_PRICE_LABEL, payUrl: `${appUrl}/billing` });
    }
}
