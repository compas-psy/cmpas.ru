import { onlineLinkLine, escapeHtml } from '@/lib/messaging/format';
import { extractFirstName } from '@/lib/person-name';

// Reminder message copy, split out from processReminders() so the neutral
// wording (product/practice/CJM_booking_v1.md §1.3, closes backlog B-260816-02)
// is unit-testable without a database. The 24h template never names the
// specialist or says "психолог" — a family member glancing at a notification
// on a shared device shouldn't be able to tell what the appointment is for.

export interface Reminder24hInput {
    clientName: string;
    time: string;
    /** «Москва (GMT+3)». Пусто — час уходит безымянным. */
    timezoneLabel?: string | null;
    format: string; // 'online' | 'offline'
    addressName?: string | null;
    onlineLink?: string | null;
    confirmationRequired: boolean;
}

export function build24hReminderText(input: Reminder24hInput): string {
    // Ссылка — за словом, а не голым адресом на полторы строки: правило
    // оформления автосообщений живёт в src/lib/messaging/format.ts.
    const line = input.format === 'online' ? onlineLinkLine(input.onlineLink) : '';
    const linkText = line ? `\n${line}` : '';
    const formatText = input.format === 'online'
        ? 'Онлайн'
        : `В кабинете: ${input.addressName || 'адрес уточнит специалист'}`;
    const confirmationText = input.confirmationRequired
        ? '\n\nПожалуйста, подтвердите встречу кнопкой ниже.'
        : '\n\nВстреча уже подтверждена.';

    // ИМЯ, А НЕ ЗАПИСЬ ИЗ КАРТОЧКИ. Здесь стояло поле целиком, и человек
    // читал «Здравствуйте, Мартынова Ирина Петровна!» — при том что сообщение
    // о самой записи в том же чате обращается по имени. Два письма одному
    // человеку в один день, написанные будто разными людьми.
    //
    // ЭКРАНИРОВАНИЕ — не украшение: напоминание уходит с разметкой Telegram,
    // и амперсанд в имени («Иванов & партнёры» у клиента-организации) делает
    // разметку недействительной. Telegram отвечает отказом, и человек просто
    // не получает напоминание.
    const name = escapeHtml(extractFirstName(input.clientName) || input.clientName);

    // Чей это час. Без пояса клиент из другого региона приходит мимо, и
    // виноватым выглядит сервис.
    const zone = input.timezoneLabel?.trim();
    const at = zone ? `${input.time} (${escapeHtml(zone)})` : input.time;

    return `Напоминание о встрече\n\nЗдравствуйте, ${name}! Завтра в ${at} у вас встреча.\nФормат: ${formatText}.${linkText}${confirmationText}`;
}
