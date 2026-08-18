/**
 * Tinkoff eAcquiring API integration
 * Docs: https://developer.tbank.ru/eacq/intro
 *
 * Auth: Token = SHA256(sorted param values concatenated + Password)
 * Test terminal: 1775405621806DEMO / MwTygrFgyCLUQcFu
 * Prod terminal: set TINKOFF_TERMINAL_KEY and TINKOFF_PASSWORD in env
 *
 * Two terminals (charter/13_TRACKING_PLAN.md §1): site and app each have
 * their own TerminalKey/password. TINKOFF_APP_TERMINAL_KEY/PASSWORD are
 * optional — until they're configured, only the site terminal is known and
 * behavior is unchanged from before.
 */
import { createHash } from 'crypto';

// Демонстрационный терминал — только для разработки. На бою молчаливый откат
// к нему означает, что деньги идут мимо кассы, а система об этом не сообщает.
// Поэтому в продакшне отсутствие ключей — громкая ошибка, а не тихий DEMO.
const DEMO_TERMINAL_KEY = '1775405621806DEMO';
const DEMO_PASSWORD = 'MwTygrFgyCLUQcFu';

const TERMINAL_KEY = process.env.TINKOFF_TERMINAL_KEY || DEMO_TERMINAL_KEY;
const PASSWORD = process.env.TINKOFF_PASSWORD || DEMO_PASSWORD;

/** Работаем ли мы сейчас на демонстрационном терминале. */
export function isDemoTerminal(): boolean {
    return TERMINAL_KEY === DEMO_TERMINAL_KEY;
}

if (process.env.NODE_ENV === 'production' && isDemoTerminal()) {
    console.error(
        '[tinkoff] TINKOFF_TERMINAL_KEY и TINKOFF_PASSWORD не заданы: приём платежей работает ' +
        'на демонстрационном терминале. Реальные платежи не проходят.'
    );
}
const TINKOFF_API = 'https://securepay.tinkoff.ru/v2';

export type Terminal = 'site' | 'app';

interface TerminalConfig {
    terminal: Terminal;
    terminalKey: string;
    password: string;
}

function terminals(): TerminalConfig[] {
    const list: TerminalConfig[] = [{ terminal: 'site', terminalKey: TERMINAL_KEY, password: PASSWORD }];
    const appKey = process.env.TINKOFF_APP_TERMINAL_KEY;
    const appPassword = process.env.TINKOFF_APP_PASSWORD;
    if (appKey && appPassword) {
        list.push({ terminal: 'app', terminalKey: appKey, password: appPassword });
    }
    return list;
}

/** Resolve which terminal a given TerminalKey belongs to, if any. */
export function resolveTerminal(terminalKey: string | undefined): TerminalConfig | null {
    if (!terminalKey) return null;
    return terminals().find(t => t.terminalKey === terminalKey) ?? null;
}

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
export function generateToken(params: Record<string, unknown>, password: string = PASSWORD): string {
    const signable: Record<string, string> = { Password: password };

    for (const [k, v] of Object.entries(params)) {
        if (k === 'Token') continue;
        // Skip nested objects (Receipt, DATA, Shops, etc.) — only flat primitives
        if (v !== null && v !== undefined && typeof v !== 'object' && typeof v !== 'function') {
            signable[k] = String(v);
        }
    }

    const sortedValues = Object.keys(signable)
        .sort()
        .map(k => signable[k])
        .join('');

    return createHash('sha256').update(sortedValues, 'utf8').digest('hex');
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
        Recurrent: 'Y',   // Enable card binding for future recurring charges
        PayType: 'O',     // One-step payment (immediate charge)
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
    Status: string; // CONFIRMED | AUTHORIZED | REJECTED | REVERSED | CANCELED | ...
    PaymentId: number;
    Amount: number;
    Token: string;
    RebillId?: number;  // Present when Recurrent=Y, save for future auto-charges
    Pan?: string;       // Masked card e.g. "430000****0777"
    CardId?: number;
    [key: string]: unknown;
}

/**
 * Verify token from a Tinkoff webhook notification, signing with the password
 * of the terminal identified by the notification's own TerminalKey. Rejects
 * notifications from a TerminalKey we don't recognize.
 */
export function verifyNotificationToken(notification: TinkoffNotification): boolean {
    const config = resolveTerminal(notification.TerminalKey);
    if (!config) return false;
    const params: Record<string, unknown> = { ...notification };
    const expectedToken = generateToken(params as any, config.password);
    return expectedToken === notification.Token;
}
