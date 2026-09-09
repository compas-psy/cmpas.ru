/**
 * Рабочие часы расписания: создание, правка и удаление окна — БЕЗ сессии.
 *
 * Зачем отдельный модуль. До него это жило только внутри server action
 * (src/app/diary/actions/availability.ts), а server action берёт специалиста
 * из auth(). Из мобильного маршрута сессии нет — там Bearer-токен, — и
 * позвать эти функции было нельзя. Итог: в приложении расписание можно было
 * только СМОТРЕТЬ, а на любую правку экран отправлял человека в веб.
 *
 * Копировать логику во второй раз было нельзя. Здесь проверка пересечений,
 * решение о кабинете и раскладка обеда — то есть ровно те правила, от
 * которых зависит, что увидит клиент на странице записи. Две копии этих
 * правил разошлись бы молча, и разошлись бы там, где это стоит человеку
 * потерянного или задвоенного часа. Ровно та же причина, по которой в
 * прошлой задаче отбор по часам переехал в block-window.ts.
 *
 * Поэтому: тут ядро, а веб-действие и мобильный маршрут — две тонкие
 * обёртки, отличающиеся только тем, откуда взялся psychologistId.
 */

import { db } from '@/lib/db';
import { resolveScheduleAddressId } from '@/lib/practice/ownership';

export const DAY_LABELS_SHORT = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

export type CreateSlotsInput = {
    startDate: string;
    endDate: string;
    daysOfWeek: number[];
    startTime: string;
    endTime: string;
    duration?: number;
    hasLunch?: boolean;
    lunchStart?: string;
    lunchEnd?: string;
    format?: string;
    addressId?: string | null;
    scheduleRuleId?: string | null;
};

/** Минуты от полуночи. Сравнивать «09:00» и «10:00» строками можно, но только
 *  пока формат ровно HH:MM — а сюда приходит и то, что прислал клиент. */
function minutesOf(time: string): number {
    const [h, m] = time.split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
}

export type SlotOverlap = { dayOfWeek: number; startTime: string; endTime: string };

/**
 * Пересекается ли новое окно с уже существующими.
 *
 * Вынесено отдельной чистой функцией, потому что это и есть то правило, из-за
 * которого расписание либо сходится, либо задваивает часы. Касание краями
 * пересечением НЕ считается: окно 09:00–13:00 и окно 13:00–18:00 стоят рядом,
 * а не поверх друг друга.
 */
export function findSlotOverlap(
    candidate: { daysOfWeek: number[]; startTime: string; endTime: string; start: Date; end: Date },
    existing: Array<{ dayOfWeek: number; startTime: string; endTime: string; startDate: Date | null; endDate: Date | null; id?: string }>,
    ignoreId?: string,
): SlotOverlap | null {
    const newStartMins = minutesOf(candidate.startTime);
    const newEndMins = minutesOf(candidate.endTime);

    for (const slot of existing) {
        if (ignoreId && slot.id === ignoreId) continue;
        if (!candidate.daysOfWeek.includes(slot.dayOfWeek)) continue;

        const existStart = slot.startDate ? slot.startDate.getTime() : 0;
        const existEnd = slot.endDate ? slot.endDate.getTime() : Infinity;
        if (candidate.start.getTime() > existEnd || candidate.end.getTime() < existStart) continue;

        if (newStartMins < minutesOf(slot.endTime) && newEndMins > minutesOf(slot.startTime)) {
            return { dayOfWeek: slot.dayOfWeek, startTime: slot.startTime, endTime: slot.endTime };
        }
    }
    return null;
}

export function overlapMessage(overlap: SlotOverlap): string {
    return `Расписание пересекается с существующим: ${DAY_LABELS_SHORT[overlap.dayOfWeek]} ${overlap.startTime}–${overlap.endTime}`;
}

/**
 * Завести окна. Возвращает, сколько строк создано.
 *
 * Обед — это не поле окна, а ДЫРА в нём: день с обедом складывается из двух
 * окон, до и после. Так было с самого начала, и менять здесь нечего — важно
 * только, чтобы оба входа складывали его одинаково.
 */
export async function createSlotsFor(psychologistId: string, data: CreateSlotsInput): Promise<number> {
    const start = new Date(data.startDate);
    const end = new Date(data.endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        throw new Error('Некорректные даты начала или окончания');
    }
    if (!Array.isArray(data.daysOfWeek) || data.daysOfWeek.length === 0) {
        throw new Error('Выберите хотя бы один день недели');
    }
    if (data.startTime >= data.endTime) {
        throw new Error('Конец должен быть позже начала');
    }

    const isRecurring = start.getTime() !== end.getTime();

    // Задача 18 P0-2: кабинет решается на сервере — чужой или выведенный
    // из работы не сохранится, а у онлайн-окна кабинета не будет, что бы
    // ни прислал вызывающий.
    const addressId = await resolveScheduleAddressId(psychologistId, data.format, data.addressId);

    const existingSlots = await db.availabilitySlot.findMany({
        where: { psychologistId, isActive: true },
    });

    const overlap = findSlotOverlap(
        { daysOfWeek: data.daysOfWeek, startTime: data.startTime, endTime: data.endTime, start, end },
        existingSlots,
    );
    if (overlap) throw new Error(overlapMessage(overlap));

    const slotsToCreate = [];
    for (const dayOfWeek of data.daysOfWeek) {
        const baseSlot = {
            psychologistId,
            dayOfWeek,
            duration: data.duration || 50,
            isRecurring,
            startDate: start,
            endDate: end,
            format: data.format || 'online',
            addressId,
            isActive: true,
            scheduleRuleId: data.scheduleRuleId || null,
        };

        if (data.hasLunch && data.lunchStart && data.lunchEnd) {
            slotsToCreate.push({ ...baseSlot, startTime: data.startTime, endTime: data.lunchStart });
            slotsToCreate.push({ ...baseSlot, startTime: data.lunchEnd, endTime: data.endTime });
        } else {
            slotsToCreate.push({ ...baseSlot, startTime: data.startTime, endTime: data.endTime });
        }
    }

    // По одной, а не createMany: так было и раньше — createMany здесь
    // спотыкался о значения по умолчанию для cuid.
    for (const slotData of slotsToCreate) {
        await db.availabilitySlot.create({ data: slotData });
    }
    return slotsToCreate.length;
}

export type UpdateSlotInput = {
    startTime: string;
    endTime: string;
    duration?: number;
    format?: string;
    addressId?: string | null;
};

/**
 * Поправить одно окно.
 *
 * Чужое окно отвечает «не найдено», а не «нельзя»: идентификатор в запросе —
 * не разрешение (Task 1), и по ответу нельзя отличить «есть, но чужое» от
 * «нет такого».
 */
export async function updateSlotFor(psychologistId: string, id: string, data: UpdateSlotInput): Promise<void> {
    if (data.startTime >= data.endTime) throw new Error('Конец должен быть позже начала');

    const existing = await db.availabilitySlot.findFirst({ where: { id, psychologistId } });
    if (!existing) throw new Error('Окно не найдено');

    const addressId = await resolveScheduleAddressId(psychologistId, data.format ?? existing.format, data.addressId);

    // Правка тоже обязана проверяться на пересечения — иначе через приложение
    // можно было бы сдвинуть окно поверх соседнего, чего форма создания не
    // позволяет. Само правимое окно из проверки исключено.
    const siblings = await db.availabilitySlot.findMany({ where: { psychologistId, isActive: true } });
    const overlap = findSlotOverlap(
        {
            daysOfWeek: [existing.dayOfWeek],
            startTime: data.startTime,
            endTime: data.endTime,
            start: existing.startDate ?? new Date(0),
            end: existing.endDate ?? new Date(8640000000000000),
        },
        siblings,
        id,
    );
    if (overlap) throw new Error(overlapMessage(overlap));

    await db.availabilitySlot.update({
        where: { id },
        data: {
            startTime: data.startTime,
            endTime: data.endTime,
            duration: data.duration ?? existing.duration,
            format: data.format ?? existing.format,
            addressId,
        },
    });
}

/** Удалить окно. Чужое просто не удалится — запрос сужен по специалисту. */
export async function deleteSlotFor(psychologistId: string, id: string): Promise<number> {
    const result = await db.availabilitySlot.deleteMany({ where: { id, psychologistId } });
    return result.count;
}
