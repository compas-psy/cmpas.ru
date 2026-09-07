/**
 * Календарная неделя специалиста: понедельник–воскресенье.
 *
 * Заведено потому, что «неделя» в системе понималась двумя способами
 * одновременно. Календарь в приложении считал её Пн–Вс, а плитка «за
 * неделю» на дашборде — как последние семь дней НАЗАД. Для специалиста,
 * который в понедельник смотрит на встречу в среду, разница не
 * теоретическая: в старое окно эта встреча не попадала по построению, и
 * плитка молчала именно о том, к чему он готовится.
 *
 * Границы считаются в UTC, а не через setHours: даты сессий и блокировок
 * записаны как полночь UTC (Date.UTC в booking.ts), и смешивать это с
 * часовым поясом ОС сервера нельзя — пока сервер в UTC разницы нет, но при
 * переезде «сегодня» уехало бы на сутки.
 */

/** Полночь календарного дня в UTC. */
export function utcDayStart(value: Date): Date {
    return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

export function addDays(day: Date, count: number): Date {
    return new Date(day.getTime() + count * 24 * 60 * 60 * 1000);
}

/**
 * Понедельник недели, в которую попадает день.
 *
 * getUTCDay() отдаёт воскресенье нулём — поэтому 0 приводится к 7, иначе
 * воскресенье уехало бы в начало СЛЕДУЮЩЕЙ недели, то есть ровно в тот
 * день, когда неделя заканчивается, счётчик обнулялся бы досрочно.
 */
export function startOfIsoWeek(day: Date): Date {
    const weekday = day.getUTCDay() || 7;
    return addDays(utcDayStart(day), 1 - weekday);
}

/** Полуинтервал [понедельник, следующий понедельник) вокруг дня. */
export function isoWeekWindow(day: Date): { start: Date; end: Date } {
    const start = startOfIsoWeek(day);
    return { start, end: addDays(start, 7) };
}
