import { NextRequest, NextResponse } from 'next/server';
import { authenticateMobileRequest, unauthorizedResponse } from '@/lib/mobile-auth';
import { readPaymentSettings, writePaymentSettings, isValidPaymentLink } from '@/lib/practice/payment-settings';
import { clampReminderHours, DEFAULT_REMINDER_HOURS } from '@/lib/messaging/payment-reminder-interval';

/**
 * Оплата клиентом — с телефона.
 *
 * Отсюда правится то, что меняется на ходу: ссылка на оплату (у большинства
 * это статическая ссылка СБП) и напоминание перед встречей — включено ли оно
 * и за сколько часов уходит. Длинный текст инструкции остаётся веб-кабинету:
 * набирать его на телефоне никто не станет, и делать вид, что станет,
 * незачем.
 *
 * Пишется через то же ядро, что и веб-кабинет, и в режиме patch: поля,
 * которых в приложении нет, обязаны остаться нетронутыми.
 */
type Payload = {
    isEnabled: boolean;
    paymentLink: string | null;
    hasPaymentText: boolean;
    hasPaymentQrUrl: boolean;
    paymentReminderEnabled: boolean;
    paymentReminderHoursBefore: number;
};

function toPayload(settings: Awaited<ReturnType<typeof readPaymentSettings>>): Payload {
    return {
        isEnabled: !!settings?.isEnabled,
        paymentLink: settings?.paymentLink ?? null,
        // Сам текст в приложение не уезжает: показывать его там негде, а
        // знать, заполнен ли он, экрану нужно — иначе «оплата настроена»
        // выглядит одинаково у того, кто её настроил, и у того, кто нет.
        hasPaymentText: !!settings?.paymentText,
        hasPaymentQrUrl: !!settings?.paymentQrUrl,
        paymentReminderEnabled: !!settings?.paymentReminderEnabled,
        paymentReminderHoursBefore: clampReminderHours(settings?.paymentReminderHoursBefore ?? DEFAULT_REMINDER_HOURS),
    };
}

export async function GET(req: NextRequest) {
    const auth = await authenticateMobileRequest(req);
    if (!auth) return unauthorizedResponse();
    try {
        return NextResponse.json(toPayload(await readPaymentSettings(auth.userId)));
    } catch (error) {
        console.error('[mobile/payment-settings GET]', error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}

export async function PATCH(req: NextRequest) {
    const auth = await authenticateMobileRequest(req);
    if (!auth) return unauthorizedResponse();

    try {
        const body = await req.json().catch(() => null) as {
            isEnabled?: unknown;
            paymentLink?: unknown;
            paymentReminderEnabled?: unknown;
            paymentReminderHoursBefore?: unknown;
        } | null;
        if (!body) return NextResponse.json({ error: 'NOTHING_TO_UPDATE' }, { status: 400 });

        const patch: Parameters<typeof writePaymentSettings>[1] = {};
        if (typeof body.isEnabled === 'boolean') patch.isEnabled = body.isEnabled;
        if (typeof body.paymentReminderEnabled === 'boolean') patch.paymentReminderEnabled = body.paymentReminderEnabled;
        if (typeof body.paymentReminderHoursBefore === 'number') patch.paymentReminderHoursBefore = body.paymentReminderHoursBefore;
        if (typeof body.paymentLink === 'string') {
            const raw = body.paymentLink.trim();
            if (raw.length > 500) return NextResponse.json({ error: 'LINK_TOO_LONG' }, { status: 400 });
            if (raw && !isValidPaymentLink(raw)) return NextResponse.json({ error: 'LINK_INVALID' }, { status: 400 });
            patch.paymentLink = raw || null;
        }
        if (Object.keys(patch).length === 0) {
            return NextResponse.json({ error: 'NOTHING_TO_UPDATE' }, { status: 400 });
        }

        const saved = await writePaymentSettings(auth.userId, patch, { patch: true });
        return NextResponse.json(toPayload(saved));
    } catch (error) {
        console.error('[mobile/payment-settings PATCH]', error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
