import { messageLink } from '@/lib/messaging/format';

/**
 * ТЕКСТ ПЛАТЁЖНОЙ ИНСТРУКЦИИ — ОДНО МЕСТО ПРАВДЫ.
 *
 * Его читают двое: сообщение при заведении клиента
 * (getPaymentInstruction в src/lib/client-workflow.ts) и напоминание об
 * оплате перед сессией (src/lib/cron/payment-reminders.ts). Разойдись эти
 * два текста — один и тот же человек получил бы от одного специалиста две
 * разные инструкции по оплате одной и той же встречи.
 *
 * Модуль намеренно отдельный и без тяжёлых зависимостей: cron-задание
 * поднимается в инструментации при старте сервера, и тянуть туда весь
 * client-workflow (а с ним auth и половину приложения) ради одной строки
 * незачем.
 *
 * Последняя строка не украшение: ПРАКТИКА оплату не принимает, связи с
 * банками у неё нет и поступление денег отмечает сам специалист. Сказать это
 * обязан каждый текст, в котором есть ссылка на оплату.
 */

/** Поля настроек оплаты, из которых складывается текст для клиента. */
export type PaymentSettingsForMessage = {
    paymentText: string | null;
    paymentLink: string | null;
    paymentQrUrl: string | null;
    prepaymentRequired: boolean;
    paymentDueText: string | null;
};

export function paymentInstructionText(settings: PaymentSettingsForMessage): string {
    const lines = [
        settings.prepaymentRequired ? 'Оплата консультации производится по инструкции специалиста.' : 'Оплата консультации: по договорённости со специалистом.',
        settings.paymentDueText ? `Срок оплаты: ${settings.paymentDueText}` : '',
        settings.paymentText || '',
        // Ссылки — за словом. Ссылка на оплату у эквайринга легко занимает
        // полторы строки, и в сообщении о встрече это выглядит как мусор.
        settings.paymentLink ? messageLink(settings.paymentLink, 'Перейти к оплате') : '',
        // Готовая картинка от банка — ссылкой; код, нарисованный из ссылки
        // оплаты, уходит отдельной картинкой (paymentQrForClient), и
        // дублировать его текстом незачем.
        settings.paymentQrUrl ? messageLink(settings.paymentQrUrl, 'QR-код для оплаты') : '',
        'ПРАКТИКА не принимает оплату и не подтверждает её поступление. Статус оплаты ведёт специалист.',
    ];

    return lines.filter(Boolean).join('\n');
}
