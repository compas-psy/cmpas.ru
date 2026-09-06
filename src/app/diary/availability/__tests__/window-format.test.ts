// Задача 27, макеты W11–W12: экран расписания и страница записи должны
// называть один и тот же час одинаково.
//
// У окна формат может быть не задан — тогда его берут у правила. Так решает
// ядро записи (availability.ts: `slot.scheduleRule?.format ?? slot.format ??
// 'online'`), и именно этот формат видит клиент. Экран расписания читал
// только собственное поле окна и на пустом писал «Онлайн»: вечерние часы
// очного правила подписывались как онлайн, то есть специалисту про его же
// расписание говорили не то, что получают его клиенты.

import { describe, it, expect } from 'vitest';
import { resolveWindowFormat, windowLabel, type ScheduleWindow } from '../RuleWeekSchedule';

const cabinets = [{ id: 'cab-1', name: 'Кабинет на Петроградской' }];
const evening: ScheduleWindow = { id: 'w1', dayOfWeek: 1, startTime: '17:00', endTime: '21:00' };
const morning: ScheduleWindow = { id: 'w2', dayOfWeek: 1, startTime: '09:00', endTime: '13:00' };

describe('формат окна расписания', () => {
    it('окно без своего формата берёт формат правила', () => {
        expect(resolveWindowFormat(evening, 'offline')).toBe('offline');
        expect(resolveWindowFormat(morning, 'online')).toBe('online');
    });

    it('порядок тот же, что в ядре записи: правило важнее окна', () => {
        expect(resolveWindowFormat({ ...evening, format: 'online' }, 'offline')).toBe('offline');
    });

    it('без правила и без формата остаётся онлайн — как в ядре', () => {
        expect(resolveWindowFormat(evening, null)).toBe('online');
        expect(resolveWindowFormat(evening, undefined)).toBe('online');
    });

    it('вечерние часы очного правила подписаны кабинетом, а не «Онлайн»', () => {
        const label = windowLabel(evening, cabinets, 'offline', 'cab-1');
        expect(label).toContain('17:00–21:00');
        expect(label).toContain('Очно');
        expect(label).toContain('Кабинет на Петроградской');
        expect(label).not.toContain('Онлайн');
    });

    it('утренние онлайн-часы кабинетом не подписываются', () => {
        const label = windowLabel(morning, cabinets, 'online', 'cab-1');
        expect(label).toBe('09:00–13:00 · Онлайн');
    });

    it('кабинет берётся у окна, если он там задан явно', () => {
        const label = windowLabel({ ...evening, addressId: 'cab-1' }, cabinets, 'offline', null);
        expect(label).toContain('Кабинет на Петроградской');
    });
});
