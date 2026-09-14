import { escapeHtml, messageLink, type MessageMode } from '@/lib/messaging/format';

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
 *
 * ВИД ТЕКСТА — ТОТ ЖЕ, ЧТО У СООБЩЕНИЯ, В КОТОРОЕ ОН ВКЛАДЫВАЕТСЯ.
 *
 * 14.09.2026 клиент получил в Telegram строку `<a href="…">Перейти к
 * оплате</a>` — разметкой, как есть. Причина: здесь текст всегда собирался
 * в HTML, а сообщение вокруг него собиралось дважды — в HTML и в плоском
 * виде, — и в плоский вариант эта разметка попадала буквой. В HTML-варианте
 * было не лучше: сборщик сообщения экранировал вложенный текст целиком, и
 * `<a>` превращался в `&lt;a&gt;`. То есть ссылка была сломана в ОБОИХ
 * видах, просто по-разному.
 *
 * Поэтому режим теперь обязателен, а собирается текст ДВАЖДЫ, по разу на
 * вид: `paymentInstructionVariants`. Никто больше не выбирает за
 * сообщение, в каком виде ему нужна ссылка.
 *
 * Свободный текст специалиста экранируется в HTML-виде: это его слова, и
 * угловая скобка в них не должна становиться разметкой.
 */

/** Поля настроек оплаты, из которых складывается текст для клиента. */
export type PaymentSettingsForMessage = {
    paymentText: string | null;
    paymentLink: string | null;
    paymentQrUrl: string | null;
    prepaymentRequired: boolean;
    paymentDueText: string | null;
};

export function paymentInstructionText(settings: PaymentSettingsForMessage, mode: MessageMode = 'html'): string {
    const esc = (text: string) => (mode === 'html' ? escapeHtml(text) : text);
    const lines = [
        settings.prepaymentRequired ? 'Оплата консультации производится по инструкции специалиста.' : 'Оплата консультации: по договорённости со специалистом.',
        settings.paymentDueText ? `Срок оплаты: ${esc(settings.paymentDueText)}` : '',
        settings.paymentText ? esc(settings.paymentText) : '',
        // Ссылки — за словом. Ссылка на оплату у эквайринга легко занимает
        // полторы строки, и в сообщении о встрече это выглядит как мусор.
        settings.paymentLink ? messageLink(settings.paymentLink, 'Перейти к оплате', mode) : '',
        // Готовая картинка от банка — ссылкой; код, нарисованный из ссылки
        // оплаты, уходит отдельной картинкой (paymentQrForClient), и
        // дублировать его текстом незачем.
        settings.paymentQrUrl ? messageLink(settings.paymentQrUrl, 'QR-код для оплаты', mode) : '',
        'ПРАКТИКА не принимает оплату и не подтверждает её поступление. Статус оплаты ведёт специалист.',
    ];

    return lines.filter(Boolean).join('\n');
}

/**
 * Оба вида разом.
 *
 * Сообщение клиенту собирается дважды — в разметке и плоским текстом, — и
 * инструкция об оплате обязана существовать в обоих видах, иначе выбор
 * приходится делать вызывающему. Он его и делал неправильно.
 */
export interface PaymentInstructionVariants {
    html: string;
    plain: string;
}

export function paymentInstructionVariants(settings: PaymentSettingsForMessage): PaymentInstructionVariants {
    return {
        html: paymentInstructionText(settings, 'html'),
        plain: paymentInstructionText(settings, 'plain'),
    };
}
