/**
 * Разные рабочие часы у разных дней одного правила.
 *
 * До этого правило заводилось так: выбрал дни недели — и все они получали
 * ОДИН диапазон часов. Практик, у которого понедельник 09:00–13:00, а
 * вторник 15:00–21:00, не мог описать это одним правилом: приходилось
 * заводить второе правило на второй день, и дальше держать в голове, что
 * это одно расписание, разложенное на два.
 *
 * Серверное действие createAvailabilitySlot принимает список дней и ОДИН
 * диапазон. Значит менять надо не сервер, а раскладку: разбить выбранные
 * дни на группы с одинаковыми часами и позвать действие по разу на группу.
 * Отсюда весь этот модуль — чистые функции, чтобы раскладка и её проверки
 * жили не внутри разметки на 1300 строк.
 */

export type DayHours = { startTime: string; endTime: string };
/** Часы, заданные отдельно для дня недели. Ключ — 0 (Пн) … 6 (Вс). */
export type PerDayHours = Record<number, DayHours>;

export const WEEKDAY_FULL = [
    'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье',
];

export type RuleHoursInput = {
    /** Выбранные дни недели. */
    days: number[];
    /** Общие часы — они же значения по умолчанию для каждого дня. */
    common: DayHours;
    /** Собственные часы отдельных дней. */
    perDay?: PerDayHours;
    /** Выключатель: пока выключен, собственные часы игнорируются целиком. */
    perDayEnabled?: boolean;
};

/**
 * Часы конкретного дня.
 *
 * Пустая ячейка — это «как у всех», а не «нет часов»: человек включил
 * раздельные часы, поправил вторник и ушёл сохранять. Остальные дни должны
 * остаться такими, какими он их видел в общих полях.
 */
export function hoursForDay(day: number, input: RuleHoursInput): DayHours {
    if (!input.perDayEnabled) return input.common;
    return input.perDay?.[day] ?? input.common;
}

/**
 * Разложить выбранные дни на группы с одинаковыми часами.
 *
 * Группировка, а не «по вызову на день»: у типового расписания часы у всех
 * дней одни, и пять запросов вместо одного — это пять проверок пересечений
 * на сервере и пять шансов оставить правило с половиной окон.
 *
 * Порядок групп — по первому дню, дни внутри группы отсортированы. Порядок
 * тут не косметика: на нём держатся проверки, а человек читает подтверждение
 * в том же порядке, в каком выбирал дни.
 */
export function groupDaysByHours(input: RuleHoursInput): Array<DayHours & { days: number[] }> {
    const groups = new Map<string, DayHours & { days: number[] }>();
    for (const day of [...input.days].sort((a, b) => a - b)) {
        const hours = hoursForDay(day, input);
        const key = `${hours.startTime}-${hours.endTime}`;
        const group = groups.get(key);
        if (group) group.days.push(day);
        else groups.set(key, { startTime: hours.startTime, endTime: hours.endTime, days: [day] });
    }
    return [...groups.values()];
}

export type LunchInput = { hasLunch: boolean; lunchStart: string; lunchEnd: string };

/**
 * Проверка часов правила. Возвращает сообщение для человека или null.
 *
 * Сообщение называет ДЕНЬ. Раньше проверка была одна на всё правило, и
 * назвать было нечего; теперь дней с разными часами может быть семь, и
 * «Некорректное время» заставляло бы искать, какой именно день не так.
 *
 * Обед общий на правило, но помещаться он обязан в КАЖДЫЙ выбранный день:
 * обед 13:00–14:00 и вторник 15:00–21:00 — это не «обед вне рабочего дня»,
 * а вторник без обеда, то есть тихо другое расписание, чем человек задал.
 */
export function validateRuleHours(input: RuleHoursInput & Partial<LunchInput>): string | null {
    if (input.days.length === 0) return 'Выберите дни недели';

    for (const day of [...input.days].sort((a, b) => a - b)) {
        const { startTime, endTime } = hoursForDay(day, input);
        const name = WEEKDAY_FULL[day] ?? `День ${day}`;
        if (startTime >= endTime) return `${name}: конец рабочего дня должен быть позже начала`;
        if (input.hasLunch) {
            const { lunchStart = '', lunchEnd = '' } = input;
            if (lunchStart >= lunchEnd) return 'Некорректное время обеда';
            if (lunchStart <= startTime || lunchEnd >= endTime) {
                return `Обед ${lunchStart}–${lunchEnd} не помещается в ${name} ${startTime}–${endTime}`;
            }
        }
    }
    return null;
}

/**
 * Короткая подпись раскладки — то, что человек читает перед сохранением.
 * Одна группа подписывается просто часами: писать «Пн, Вт, Ср, Чт, Пт
 * 09:00–18:00» там, где часы у всех одни, значит пересказывать чипы дней,
 * которые он только что нажимал.
 */
export function describeRuleHours(input: RuleHoursInput, dayLabels: string[]): string {
    const groups = groupDaysByHours(input);
    if (groups.length === 0) return '';
    if (groups.length === 1) return `${groups[0].startTime}–${groups[0].endTime}`;
    return groups
        .map(g => `${g.days.map(d => dayLabels[d] ?? d).join(', ')} ${g.startTime}–${g.endTime}`)
        .join(' · ');
}
