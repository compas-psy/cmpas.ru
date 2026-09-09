/**
 * Правила рабочих часов — одни на веб и на приложение.
 *
 * До этой правки они жили внутри server action, и мобильный API умел
 * расписание только читать. Теперь их зовут оба входа, поэтому проверяется
 * не «функция работает», а то, что решает судьбу живого расписания:
 * пересечения, касание краями и то, что правка не может проехать поверх
 * соседнего окна.
 */

import { describe, it, expect } from 'vitest';
import { findSlotOverlap, overlapMessage, DAY_LABELS_SHORT } from '@/lib/practice/availability-core';

const day = (n: number) => n;
const slot = (dayOfWeek: number, startTime: string, endTime: string, id = `s-${dayOfWeek}-${startTime}`) => ({
    id, dayOfWeek, startTime, endTime,
    startDate: new Date('2026-01-01'), endDate: new Date('2026-12-31'),
});
const candidate = (days: number[], startTime: string, endTime: string) => ({
    daysOfWeek: days, startTime, endTime,
    start: new Date('2026-01-01'), end: new Date('2026-12-31'),
});

describe('пересечение окон', () => {
    it('свободный день пересечений не даёт', () => {
        expect(findSlotOverlap(candidate([day(2)], '09:00', '18:00'), [slot(0, '09:00', '18:00')])).toBeNull();
    });

    it('накладка в тот же день находится', () => {
        const overlap = findSlotOverlap(candidate([day(0)], '12:00', '20:00'), [slot(0, '09:00', '18:00')]);
        expect(overlap).toEqual({ dayOfWeek: 0, startTime: '09:00', endTime: '18:00' });
    });

    it('касание краями пересечением НЕ считается', () => {
        // Окно 09:00–13:00 и окно 13:00–18:00 стоят рядом, а не поверх друг
        // друга. Иначе день с обедом нельзя было бы собрать вовсе: он и
        // состоит из двух окон, встык к перерыву.
        expect(findSlotOverlap(candidate([day(0)], '13:00', '18:00'), [slot(0, '09:00', '13:00')])).toBeNull();
        expect(findSlotOverlap(candidate([day(0)], '06:00', '09:00'), [slot(0, '09:00', '13:00')])).toBeNull();
    });

    it('разошедшиеся периоды не пересекаются, даже если часы совпадают', () => {
        const past = {
            id: 'старое', dayOfWeek: 0, startTime: '09:00', endTime: '18:00',
            startDate: new Date('2025-01-01'), endDate: new Date('2025-06-01'),
        };
        expect(findSlotOverlap(candidate([day(0)], '09:00', '18:00'), [past])).toBeNull();
    });

    it('бессрочное окно пересекается с любым периодом', () => {
        const forever = { id: 'вечное', dayOfWeek: 0, startTime: '09:00', endTime: '18:00', startDate: null, endDate: null };
        expect(findSlotOverlap(candidate([day(0)], '10:00', '11:00'), [forever])).not.toBeNull();
    });

    it('правимое окно само себе не мешает', () => {
        // Иначе сдвинуть окно на пять минут было бы нельзя: оно пересекалось
        // бы с собой же.
        const existing = slot(0, '09:00', '18:00', 'то-самое');
        expect(findSlotOverlap(candidate([day(0)], '09:30', '18:00'), [existing], 'то-самое')).toBeNull();
    });

    it('но поверх СОСЕДНЕГО окна правка не проезжает', () => {
        const mine = slot(0, '09:00', '13:00', 'моё');
        const neighbour = slot(0, '15:00', '21:00', 'соседнее');
        const overlap = findSlotOverlap(candidate([day(0)], '09:00', '16:00'), [mine, neighbour], 'моё');
        expect(overlap).toEqual({ dayOfWeek: 0, startTime: '15:00', endTime: '21:00' });
    });

    it('сообщение называет день и часы, а не «ошибку»', () => {
        const text = overlapMessage({ dayOfWeek: 1, startTime: '10:00', endTime: '18:00' });
        expect(text).toContain(DAY_LABELS_SHORT[1]);
        expect(text).toContain('10:00');
        expect(text).toContain('18:00');
    });
});
