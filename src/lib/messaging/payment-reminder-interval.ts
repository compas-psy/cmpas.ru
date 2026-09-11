/**
 * ЗА СКОЛЬКО ДО ВСТРЕЧИ НАПОМИНАТЬ ОБ ОПЛАТЕ.
 *
 * Решение учредителя 11.09.2026: интервал выбирает специалист. Значение
 * живёт в часах и здесь же приводится к допустимому — правило одно на всех,
 * кто его читает: форма в веб-кабинете, приложение, мобильный маршрут и
 * само напоминание (src/lib/cron/payment-reminders.ts). Разойдись они — из
 * формы можно было бы сохранить «за 0 часов», то есть рассылку в момент
 * начала встречи.
 *
 * Модуль намеренно без зависимостей: его читает и клиентский экран.
 */

/** Меньше часа — это уже не «перед встречей», а «во время». */
export const MIN_REMINDER_HOURS = 1;
/** Больше недели — напоминание об оплате приходит раньше, чем человек
 *  вспомнит саму встречу. */
export const MAX_REMINDER_HOURS = 168;
/** Сутки: столько же, сколько у напоминания о самой встрече. */
export const DEFAULT_REMINDER_HOURS = 24;

export function clampReminderHours(hours: number | null | undefined): number {
    // Пусто — это «не выбирали», а не «ноль часов»: Number(null) даёт 0, и
    // без этой строки несохранённая настройка превратилась бы в напоминание
    // за час до встречи.
    if (hours === null || hours === undefined) return DEFAULT_REMINDER_HOURS;
    const value = Number(hours);
    if (!Number.isFinite(value)) return DEFAULT_REMINDER_HOURS;
    return Math.min(MAX_REMINDER_HOURS, Math.max(MIN_REMINDER_HOURS, Math.round(value)));
}

/** Готовые варианты для формы. Часы человеку ничего не говорят начиная с
 *  «48», поэтому подписи — словами. */
export const REMINDER_HOUR_OPTIONS: Array<{ hours: number; label: string }> = [
    { hours: 2, label: 'за 2 часа' },
    { hours: 6, label: 'за 6 часов' },
    { hours: 12, label: 'за 12 часов' },
    { hours: 24, label: 'за сутки' },
    { hours: 48, label: 'за двое суток' },
    { hours: 72, label: 'за трое суток' },
];

/** Подпись выбранного интервала — в том числе для значения, которого нет в
 *  списке (сохранённого раньше или пришедшего из приложения). */
export function reminderHoursLabel(hours: number): string {
    const known = REMINDER_HOUR_OPTIONS.find(o => o.hours === hours);
    if (known) return known.label;
    return `за ${hours} ч`;
}
