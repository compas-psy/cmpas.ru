/**
 * Тихие часы: сообщения клиенту не приходят ночью.
 *
 * Кто отправляет по расписанию сервера, а не по времени человека, рано или
 * поздно будит его. Живой пример из этого репозитория: каскад «через 2 часа
 * после встречи» (`processNextBookingNudge`) идёт каждые полчаса и ничем не
 * ограничен по времени суток — встреча, закончившаяся в 22:00, даёт клиенту
 * сообщение в полночь. Вопрос о самочувствии (`processPostSessionNudge`)
 * устроен так же, только окно короче.
 *
 * ЧЬИ ЧАСЫ СЧИТАЕМ. Пояса клиента продукт не знает: ни при самозаписи, ни
 * при заведении карточки его никто не спрашивает, и выдумывать его нельзя.
 * Считаем по поясу ПРАКТИКИ — того специалиста, от чьего имени уходит
 * сообщение. Это не догадка: встреча назначается в его расписании и в его
 * часах, клиент к этому времени и подстраивается.
 *
 * ГРАНИЦЫ. С 21:00 до 09:00 по поясу практики — молчим. Не «до 8» и не «до
 * 7»: сообщение от специалиста в 7 утра читается как срочное, а срочного в
 * нём ничего нет.
 *
 * ЧТО ДЕЛАЕТСЯ С ОТЛОЖЕННЫМ. Ничего не теряется: задания каскадов помечают
 * отправленное собственными полями (`nextBookingNudgeSent` и другие), и
 * несработавший из-за тишины проход просто повторится следующим — первым же
 * дневным. Поэтому здесь нужен ТОЛЬКО запрет, без очереди и без переносов.
 */

/** С этого часа и позже — тишина. */
export const QUIET_FROM_HOUR = 21;
/** До этого часа — тишина. */
export const QUIET_UNTIL_HOUR = 9;

/** Пояс, если у практики он не задан. Тот же, что умолчание в схеме. */
export const DEFAULT_TIMEZONE = 'Europe/Moscow';

/**
 * Час по указанному поясу.
 *
 * Через Intl, а не сдвигом на число часов: переход на летнее время и
 * получасовые пояса ломают любую арифметику со смещением, а список поясов
 * в продукте задаёт человек и там бывает что угодно.
 *
 * Негодное имя пояса не должно ронять рассылку: Intl бросает на неизвестной
 * зоне, и тогда считаем по умолчанию — молчать из-за опечатки в настройке
 * хуже, чем посчитать по Москве.
 */
export function hourInTimezone(timezone: string | null | undefined, now: Date = new Date()): number {
    const zone = timezone?.trim() || DEFAULT_TIMEZONE;
    try {
        return readHour(zone, now);
    } catch {
        return readHour(DEFAULT_TIMEZONE, now);
    }
}

function readHour(zone: string, now: Date): number {
    const formatted = new Intl.DateTimeFormat('en-GB', {
        timeZone: zone,
        hour: '2-digit',
        hour12: false,
    }).format(now);
    // en-GB с hour12:false отдаёт «00»…«23»; «24» встречается в части сред
    // для полуночи — это тот же нулевой час.
    const hour = Number(formatted);
    return Number.isFinite(hour) ? hour % 24 : 0;
}

/** День недели по поясу практики: 1 — понедельник, 7 — воскресенье. */
export function weekdayInTimezone(timezone: string | null | undefined, now: Date = new Date()): number {
    const zone = timezone?.trim() || DEFAULT_TIMEZONE;
    const read = (tz: string) => new Intl.DateTimeFormat('en-GB', { timeZone: tz, weekday: 'short' }).format(now);
    let short: string;
    try {
        short = read(zone);
    } catch {
        short = read(DEFAULT_TIMEZONE);
    }
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    return days.indexOf(short) + 1;
}

/**
 * Сейчас тихий час у этой практики?
 *
 * @param timezone пояс практики (PsychologistSettings.timezone)
 */
export function isQuietHour(timezone: string | null | undefined, now: Date = new Date()): boolean {
    const hour = hourInTimezone(timezone, now);
    return hour >= QUIET_FROM_HOUR || hour < QUIET_UNTIL_HOUR;
}

/**
 * Человеческое описание окна — для настроек и для объяснений в интерфейсе.
 * Одно место правды: изменив границы выше, не придётся искать текст.
 */
export const QUIET_HOURS_LABEL = `с ${QUIET_FROM_HOUR}:00 до ${QUIET_UNTIL_HOUR}:00`;
