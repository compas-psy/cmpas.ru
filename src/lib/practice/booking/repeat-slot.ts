import { db } from '@/lib/db';
import { createManualPracticeSession, BookingConflictError } from './booking';

/**
 * ТОТ ЖЕ ЧАС ЧЕРЕЗ НЕДЕЛЮ — И НА НЕСКОЛЬКО НЕДЕЛЬ ВПЕРЁД.
 *
 * Регулярная работа устроена так: клиент ходит по вторникам в 14:00, и это
 * не решается заново каждую неделю. В карточке клиента такого действия не
 * было вовсе — чтобы занять тот же час, специалист открывал форму записи,
 * выбирал клиента, листал календарь, искал время. Семь шагов ради того, что
 * уже известно из прошлой встречи.
 *
 * Здесь одно ядро на оба случая: «через неделю» — это weeks = 1, «занять
 * слот на срок» — weeks = N. Разницы в механике нет, и заводить два пути
 * было бы выдумкой.
 *
 * Каждая встреча создаётся ТЕМ ЖЕ createManualPracticeSession, что и ручная
 * запись: блокировка на день, реальная проверка maxSessionsPerDay и
 * пересечений. Второго, более снисходительного пути записи в обход этих
 * проверок здесь нет — иначе «занять на 12 недель» стало бы способом
 * поставить встречу поверх чужой.
 *
 * И потому же результат — не «получилось/не получилось», а поимённый отчёт:
 * если третья неделя занята, первые две всё равно записаны, и специалист
 * видит, какая именно дата выпала и почему.
 */

export { MAX_REPEAT_WEEKS, REPEAT_WEEK_PRESETS } from './repeat-slot-limits';
import { MAX_REPEAT_WEEKS } from './repeat-slot-limits';

export interface RepeatSlotInput {
    psychologistId: string;
    clientId: string;
    /** Сколько недель подряд занять, начиная с ближайшей будущей. 1 — только следующая. */
    weeks: number;
    /** Опорная встреча. По умолчанию — та, из которой и так понятен «тот же час». */
    fromSessionId?: string;
}

export interface RepeatSlotBooked {
    date: string;
    time: string;
    sessionId: string;
}

export interface RepeatSlotSkipped {
    date: string;
    time: string;
    /** Слова самого ядра записи: «время занято», «максимум записей на день». */
    reason: string;
}

export interface RepeatSlotResult {
    reference: { sessionId: string; date: string; time: string };
    booked: RepeatSlotBooked[];
    skipped: RepeatSlotSkipped[];
}

export class NoReferenceSessionError extends Error {
    constructor() {
        super('У клиента ещё нет ни одной встречи — повторять нечего.');
        this.name = 'NoReferenceSessionError';
    }
}

/** Дата хранится как полночь UTC (см. createManualPracticeSession), поэтому и арифметика — в UTC. */
function toDateStr(d: Date): string {
    return d.toISOString().slice(0, 10);
}

function addDaysUTC(d: Date, days: number): Date {
    return new Date(d.getTime() + days * 24 * 60 * 60 * 1000);
}

/**
 * Опорная встреча: ближайшая будущая, если она есть, иначе последняя
 * прошедшая. Будущая важнее: если специалист уже назначил вторник 14:00 на
 * следующей неделе, «занять слот» продолжает именно её, а не позапрошлый
 * четверг.
 *
 * Отменённые не в счёт — их час как раз освобождён.
 */
async function pickReferenceSession(input: RepeatSlotInput, now: Date) {
    if (input.fromSessionId) {
        const chosen = await db.diarySession.findFirst({
            where: { id: input.fromSessionId, psychologistId: input.psychologistId, clientId: input.clientId },
        });
        if (!chosen) throw new NoReferenceSessionError();
        return chosen;
    }

    const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const where = { psychologistId: input.psychologistId, clientId: input.clientId, status: { not: 'cancelled' } };

    const future = await db.diarySession.findFirst({
        where: { ...where, date: { gte: todayStart } },
        orderBy: [{ date: 'asc' }, { time: 'asc' }],
    });
    if (future) return future;

    const past = await db.diarySession.findFirst({ where, orderBy: [{ date: 'desc' }, { time: 'desc' }] });
    if (!past) throw new NoReferenceSessionError();
    return past;
}

export async function repeatClientSlot(input: RepeatSlotInput, now: Date = new Date()): Promise<RepeatSlotResult> {
    const weeks = Math.min(Math.max(Math.trunc(input.weeks), 1), MAX_REPEAT_WEEKS);
    const reference = await pickReferenceSession(input, now);

    // Первая занимаемая дата — тот же день недели, но обязательно в будущем.
    // Опорная встреча может быть и прошлой: тогда шагаем от неё неделями,
    // пока не выйдем за сегодня, и только потом начинаем занимать.
    const todayStr = toDateStr(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())));
    let cursor = addDaysUTC(reference.date, 7);
    while (toDateStr(cursor) <= todayStr) cursor = addDaysUTC(cursor, 7);

    const booked: RepeatSlotBooked[] = [];
    const skipped: RepeatSlotSkipped[] = [];

    for (let i = 0; i < weeks; i++) {
        const dateStr = toDateStr(cursor);
        try {
            const { session } = await createManualPracticeSession({
                psychologistId: input.psychologistId,
                clientId: input.clientId,
                dateStr,
                time: reference.time,
                // Час повторяется целиком: та же длительность, формат, тип и
                // кабинет. Иначе «тот же слот» им бы не был.
                duration: reference.duration || 50,
                type: reference.type || 'individual',
                format: reference.format || 'online',
                addressId: reference.addressId ?? null,
            });
            booked.push({ date: dateStr, time: reference.time, sessionId: session.id });
        } catch (error) {
            if (error instanceof BookingConflictError) {
                skipped.push({ date: dateStr, time: reference.time, reason: error.message });
            } else {
                throw error;
            }
        }
        cursor = addDaysUTC(cursor, 7);
    }

    return {
        reference: { sessionId: reference.id, date: toDateStr(reference.date), time: reference.time },
        booked,
        skipped,
    };
}
