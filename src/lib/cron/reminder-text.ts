// Reminder message copy, split out from processReminders() so the neutral
// wording (product/practice/CJM_booking_v1.md §1.3, closes backlog B-260816-02)
// is unit-testable without a database. The 24h template never names the
// specialist or says "психолог" — a family member glancing at a notification
// on a shared device shouldn't be able to tell what the appointment is for.

export interface Reminder24hInput {
    clientName: string;
    time: string;
    format: string; // 'online' | 'offline'
    addressName?: string | null;
    onlineLink?: string | null;
    confirmationRequired: boolean;
}

export function build24hReminderText(input: Reminder24hInput): string {
    const linkText = input.format === 'online' && input.onlineLink
        ? `\n🔗 Ссылка для подключения: ${input.onlineLink}`
        : '';
    const formatText = input.format === 'online'
        ? 'Онлайн'
        : `В кабинете: ${input.addressName || 'адрес уточнит специалист'}`;
    const confirmationText = input.confirmationRequired
        ? '\n\nПожалуйста, подтвердите встречу кнопкой ниже.'
        : '\n\nВстреча уже подтверждена.';

    return `Напоминание о встрече\n\nЗдравствуйте, ${input.clientName}! Завтра в ${input.time} у вас встреча.\nФормат: ${formatText}.${linkText}${confirmationText}`;
}
