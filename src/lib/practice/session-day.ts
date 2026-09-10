/**
 * ДЕНЬ ВСТРЕЧИ КАК КЛЮЧ СРАВНЕНИЯ.
 *
 * 10.09.2026 карточка клиента переставала открываться — но не у всех, а у
 * пятерых, с кем специалист работает чаще прочих:
 *
 *     TypeError: e.date.localeCompare is not a function
 *
 * Код сортировал встречи так: `a.date.localeCompare(b.date)`. Он считал, что
 * `date` — строка «2026-09-17». На деле серверное действие отдаёт то, что
 * пришло из базы, а там это `Date`; сериализация серверных действий объекты
 * дат СОХРАНЯЕТ, а не превращает в строки. У `Date` нет `localeCompare`.
 *
 * Почему падало не у всех: `Array.prototype.sort` зовёт сравнение ТОЛЬКО
 * когда элементов два и больше. У клиента с одной будущей встречей ошибка не
 * возникала вовсе. Она ждала тех, у кого встреч несколько, — то есть
 * постоянных клиентов, и особенно тех, кому только что заняли час на срок.
 * Самая нужная карточка ломалась первой.
 *
 * Тип в коде говорил `date: string` и потому эту ошибку прятал: компилятор
 * видел строку, браузер получал дату. Здесь принимаются оба вида, и оба
 * приводятся к одному ключу «ГГГГ-ММ-ДД» — сравнимому построчно.
 *
 * Ключ считается по UTC намеренно: дата встречи хранится как полночь UTC,
 * и перевод её в местный пояс сдвинул бы день у половины часовых поясов.
 * Для СРАВНЕНИЯ важна не подпись на экране, а устойчивый порядок.
 */
export function sessionDayKey(value: string | Date | null | undefined): string {
    if (!value) return '';
    if (typeof value === 'string') return value.slice(0, 10);
    const time = value instanceof Date ? value.getTime() : new Date(value as never).getTime();
    if (!Number.isFinite(time)) return '';
    return new Date(time).toISOString().slice(0, 10);
}

/** Порядок «по дню, затем по часу» — тот же, что у сервера при выборе опорной встречи. */
export function compareByDayThenTime(
    a: { date: string | Date; time?: string | null },
    b: { date: string | Date; time?: string | null },
): number {
    return sessionDayKey(a.date).localeCompare(sessionDayKey(b.date))
        || (a.time ?? '').localeCompare(b.time ?? '');
}
