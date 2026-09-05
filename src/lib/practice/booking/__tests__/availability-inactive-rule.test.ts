// Задача 18, P0-1: выключенное ScheduleRule не публикует часы клиентам.
//
// Тумблер в расписании специалиста звал updateScheduleRule({ isActive: false }),
// но резолвер Задачи 6 про это поле не знал: выключенное правило продолжало
// показывать свои окна на странице записи. Здесь зафиксирована ровно та
// семантика источника правды, которая теперь в резолвере:
//
//   действующий слот И (правила нет ИЛИ правило включено)
//
// Всё, что читает доступность — getAvailableDates, getAvailableTimes,
// подбор времени — идёт через этот же резолвер, отдельного второго нет.

import { describe, it, expect } from 'vitest';
import { resolveAvailableTimesForDay } from '../availability';
import type { AvailabilitySlotInput, ScheduleRuleInput } from '../types';

const MONDAY = '2026-09-07';

function rule(id: string, isActive: boolean, over: Partial<ScheduleRuleInput> = {}): ScheduleRuleInput {
    return {
        id,
        isActive,
        format: 'online',
        addressId: null,
        duration: 50,
        breakDuration: 15,
        audienceFilter: 'all',
        startDate: null,
        endDate: null,
        ...over,
    };
}

function slotFor(r: ScheduleRuleInput | null, id: string, startTime: string, endTime: string): AvailabilitySlotInput {
    return {
        id,
        dayOfWeek: 0, // понедельник
        startTime,
        endTime,
        duration: null,
        format: null,
        addressId: null,
        startDate: null,
        endDate: null,
        scheduleRuleId: r?.id ?? null,
        scheduleRule: r,
    };
}

function resolve(slots: AvailabilitySlotInput[]) {
    return resolveAvailableTimesForDay({
        dateStr: MONDAY,
        slots,
        blocks: [],
        sessions: [],
        settings: { maxSessionsPerDay: null, sessionBreak: 15, bookingBufferHours: 0, bookingHorizonDays: 365 },
        skipBuffer: true,
    });
}

// Приёмочный случай из ТЗ: утреннее онлайн-правило и вечернее очное.
const RULE_A_ONLINE = (isActive: boolean) => rule('rule-a', isActive);
const RULE_B_OFFICE = (isActive: boolean) => rule('rule-b', isActive, { format: 'offline', addressId: 'a-yauzskaya' });

function fixture(aActive: boolean, bActive: boolean) {
    return [
        slotFor(RULE_A_ONLINE(aActive), 'slot-a', '09:00', '13:00'),
        slotFor(RULE_B_OFFICE(bActive), 'slot-b', '15:00', '21:00'),
    ];
}

describe('P0-1: выключенное правило не даёт клиентских слотов', () => {
    it('правило A включено, правило B выключено — клиент видит только 09–13', () => {
        const result = resolve(fixture(true, false));

        expect(result.length).toBeGreaterThan(0);
        expect(result.every(s => s.time >= '09:00' && s.time < '13:00')).toBe(true);
        expect(result.every(s => s.scheduleRuleId === 'rule-a')).toBe(true);
        expect(result.some(s => s.format === 'offline')).toBe(false);
    });

    it('включили B обратно — клиент снова видит оба окна', () => {
        const onlyMorning = resolve(fixture(true, false));
        const both = resolve(fixture(true, true));

        expect(both.length).toBeGreaterThan(onlyMorning.length);
        expect(both.some(s => s.scheduleRuleId === 'rule-a')).toBe(true);
        expect(both.some(s => s.scheduleRuleId === 'rule-b')).toBe(true);
    });

    it('выключили A — остаётся только вечернее B, соседнее правило не пострадало', () => {
        const result = resolve(fixture(false, true));

        expect(result.length).toBeGreaterThan(0);
        expect(result.every(s => s.scheduleRuleId === 'rule-b')).toBe(true);
        expect(result.every(s => s.time >= '15:00')).toBe(true);
        expect(result.every(s => s.format === 'offline' && s.addressId === 'a-yauzskaya')).toBe(true);
    });

    it('оба правила выключены — клиенту нечего показать', () => {
        expect(resolve(fixture(false, false))).toEqual([]);
    });

    it('окно без правила (ad-hoc) остаётся доступным — выключать нечего', () => {
        const result = resolve([slotFor(null, 'slot-adhoc', '09:00', '11:00')]);

        expect(result.length).toBeGreaterThan(0);
        expect(result.every(s => s.scheduleRuleId === null)).toBe(true);
    });

    it('выключенное правило не тянет за собой окна другого дня того же правила', () => {
        const inactive = RULE_B_OFFICE(false);
        const tuesday = { ...slotFor(inactive, 'slot-tue', '10:00', '18:00'), dayOfWeek: 1 };

        const result = resolve([slotFor(RULE_A_ONLINE(true), 'slot-a', '09:00', '13:00'), tuesday]);

        expect(result.every(s => s.scheduleRuleId === 'rule-a')).toBe(true);
    });
});
