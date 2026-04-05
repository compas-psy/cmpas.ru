/**
 * Tinkoff eAcquiring API integration
 * Docs: https://developer.tbank.ru/eacq/intro
 *
 * Auth: Token = SHA256(sorted param values concatenated + Password)
 * Test terminal: 1775405621806DEMO / MwTygrFgyCLUQcFu
 * Prod terminal: set TINKOFF_TERMINAL_KEY and TINKOFF_PASSWORD in env
 */
import crypto from 'crypto';

const TINKOFF_API = 'https://securepay.tinkoff.ru/v2';
const TERMINAL_KEY = process.env.TINKOFF_TERMINAL_KEY || '1775405621806DEMO';
const PASSWORD = process.env.TINKOFF_PASSWORD || 'MwTygrFgyCLUQcFu';

export const PLANS = {
    practice: {
        name: 'Практика',
        price: 99000, // kopecks = 990 руб
        description: 'Подписка КОМПАС «Практика» — 1 месяц',
    },
    practice_plus: {
        name: 'Практика+',
        price: 199000, // kopecks = 1990 руб
        description: 'Подписка КОМПАС «Практика+» — 1 месяц',
    },
} as const;

export type PlanKey = keyof typeof PLANS;

/**
 * Generate Tinkoff token (signature)
 * Algorithm: sort all params by key, concatenate values (not keys), SHA256
 * Special: exclude Token, Receipt, DATA from signing; add Password to params first
 */
export function generateToken(params: Record<string, string | number | boolean>): string {
    const signable = { ...params, Password: PASSWORD };
    delete (signable as any).Token;
    delete (signable as any).Receipt;
    delete (signable as any).DATA;

    const sortedValues = Object.keys(signable)
        .sort()
        .map(k => String((signable as any)[k]))
        .join('');

    return crypto.createHash('sha256').update(sortedValues).digest('hex');
}

export interface InitPaymentParams {
    orderId: string;
    amount: number; // kopecks
    description: string;
    customerKey: string; // user ID
    successUrl: string;
    failUrl: string;
    notificationUrl: string;
}

export interface InitPaymentResult {
    success: boolean;
    paymentId?: string;
    paymentUrl?: string;
    status?: string;
    errorMessage?: string;
}

/** Create a payment via Tinkoff /v2/Init */
export async function initPayment(p: InitPaymentParams): Promise<InitPaymentResult> {
    const params: Record<string, string | number> = {
        TerminalKey: TERMINAL_KEY,
        Amount: p.amount,
        OrderId: p.orderId,
        Description: p.description,
        CustomerKey: p.customerKey,
        SuccessURL: p.successUrl,
        FailURL: p.failUrl,
        NotificationURL: p.notificationUrl,
    };

    const token = generateToken(params as any);

    try {
        const res = await fetch(`${TINKOFF_API}/Init`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...params, Token: token }),
        });

        const data = await res.json();
        console.log('[Tinkoff] Init response:', JSON.stringify(data));

        if (!data.Success) {
            return { success: false, errorMessage: data.Message || data.Details || 'Ошибка создания платежа' };
        }

        return {
            success: true,
            paymentId: String(data.PaymentId),
            paymentUrl: data.PaymentURL,
            status: data.Status,
        };
    } catch (e: any) {
        console.error('[Tinkoff] Init error:', e);
        return { success: false, errorMessage: e.message };
    }
}

export interface TinkoffNotification {
    TerminalKey: string;
    OrderId: string;
    Success: boolean;
    Status: string; // CONFIRMED | AUTHORIZED | REJECTED | REVERSED | ...
    PaymentId: number;
    Amount: number;
    Token: string;
    [key: string]: unknown;
}

/** Verify token from Tinkoff webhook notification */
export function verifyNotificationToken(notification: TinkoffNotification): boolean {
    const params: Record<string, unknown> = { ...notification };
    const expectedToken = generateToken(params as any);
    return expectedToken === notification.Token;
}
