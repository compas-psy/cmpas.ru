/**
 * Блокировка времени: часы, а не только дни.
 *
 * Данные это умели с самого начала — у DiaryBlock есть startTime и endTime, и
 * мобильное приложение их присылает. Не умела форма в вебе: она спрашивала
 * «с какого по какое ЧИСЛО» и молча ставила 00:00–23:59. Специалист, которому
 * нужно закрыть два часа во вторник, закрывал весь вторник — и терял день.
 *
 * Правило пересечения вынесено сюда, потому что оно было написано ровно один
 * раз и только в мобильном маршруте (src/app/api/mobile/blocks/route.ts).
 * Веб при отмене пересекающихся сессий не смотрел на часы вовсе: с часовой
 * блокировкой он предложил бы отменить ВЕСЬ день. Две трактовки одного
 * правила здесь — это отменённые встречи живых людей.
 */

/** Целый день. Ровно те значения, что веб писал молча до этой правки. */
export const WHOLE_DAY_START = '00:00';
export const WHOLE_DAY_END = '23:59';

const HH_MM = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function minutesOf(value: string): number {
    const [hours, minutes] = value.split(':').map(Number);
    return hours * 60 + minutes;
}

function toHhMm(totalMinutes: number): string {
    const capped = Math.min(totalMinutes, 23 * 60 + 59);
    return `${String(Math.floor(capped / 60)).padStart(2, '0')}:${String(capped % 60).padStart(2, '0')}`;
}

/** Годное «ЧЧ:ММ» или запасное значение. Мусор не пропускаем в базу. */
export function normalizeTime(value: unknown, fallback: string): string {
    if (typeof value !== 'string') return fallback;
    const trimmed = value.trim();
    return HH_MM.test(trimmed) ? trimmed : fallback;
}

export type BlockWindow = { startTime: string; endTime: string };

/**
 * Окно блокировки из того, что пришло с формы.
 *
 * Часы не заданы — целый день: так вело себя веб-действие раньше, и молчаливо
 * менять это на «ничего не заблокировано» нельзя.
 *
 * Конец раньше начала — не окно. Возвращаем null, чтобы вызывающий ответил
 * человеку, а не записал в базу блокировку, которая ничего не закрывает.
 */
export function resolveBlockWindow(input: { startTime?: unknown; endTime?: unknown }): BlockWindow | null {
    const startTime = normalizeTime(input.startTime, WHOLE_DAY_START);
    const endTime = normalizeTime(input.endTime, WHOLE_DAY_END);
    if (minutesOf(startTime) >= minutesOf(endTime)) return null;
    return { startTime, endTime };
}

export function isWholeDay(window: BlockWindow): boolean {
    return window.startTime === WHOLE_DAY_START && window.endTime === WHOLE_DAY_END;
}

/**
 * Конец встречи. endTime у сессии необязателен, тогда считается по
 * длительности; нет и её — 50 минут, как везде в продукте.
 */
export function sessionEndTime(session: { time?: string | null; endTime?: string | null; duration?: number | null }): string {
    if (session.endTime && HH_MM.test(session.endTime)) return session.endTime;
    const start = normalizeTime(session.time, WHOLE_DAY_START);
    return toHhMm(minutesOf(start) + (session.duration || 50));
}

/**
 * Попадает ли встреча в окно блокировки.
 *
 * Касание краями пересечением НЕ считается: встреча 10:00–11:00 и блокировка
 * 11:00–12:00 стоят рядом, а не мешают друг другу. Иначе блокировка обеда
 * предлагала бы отменить встречу, которая к обеду уже закончилась.
 */
export function sessionOverlapsBlock(
    session: { time?: string | null; endTime?: string | null; duration?: number | null },
    window: BlockWindow,
): boolean {
    const start = normalizeTime(session.time, WHOLE_DAY_START);
    const end = sessionEndTime(session);
    return minutesOf(start) < minutesOf(window.endTime) && minutesOf(end) > minutesOf(window.startTime);
}

/** Подпись окна для человека: «весь день» или «10:00–12:00». */
export function blockWindowLabel(window: BlockWindow): string {
    return isWholeDay(window) ? 'весь день' : `${window.startTime}–${window.endTime}`;
}
