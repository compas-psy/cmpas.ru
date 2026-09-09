/**
 * Разные часы у разных дней одного правила.
 *
 * Проверяется не «функция вернула объект», а то, из-за чего задача завелась:
 * практик с понедельником 09:00–13:00 и вторником 15:00–21:00 должен уметь
 * описать это ОДНИМ правилом, и ни один день не должен молча получить чужие
 * часы или потерять обед.
 */

import { describe, it, expect } from 'vitest';
import {
    hoursForDay,
    groupDaysByHours,
    validateRuleHours,
    describeRuleHours,
    WEEKDAY_FULL,
} from '@/lib/practice/rule-day-hours';

const DAY_LABELS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const common = { startTime: '09:00', endTime: '18:00' };

describe('часы дня', () => {
    it('без раздельных часов у всех дней общие', () => {
        const input = { days: [0, 1, 2], common, perDay: { 1: { startTime: '15:00', endTime: '21:00' } } };
        // perDayEnabled не включён — собственные часы вторника игнорируются
        // целиком, а не «применяются, раз уж заданы». Иначе выключатель не
        // выключал бы, и человек сохранял бы не то, что видит.
        expect(hoursForDay(1, input)).toEqual(common);
    });

    it('день без собственных часов берёт общие, даже когда раздельные включены', () => {
        const input = {
            days: [0, 1], common, perDayEnabled: true,
            perDay: { 1: { startTime: '15:00', endTime: '21:00' } },
        };
        expect(hoursForDay(0, input)).toEqual(common);
        expect(hoursForDay(1, input)).toEqual({ startTime: '15:00', endTime: '21:00' });
    });
});

describe('раскладка на группы', () => {
    it('одинаковые часы — одна группа и один запрос к серверу', () => {
        const groups = groupDaysByHours({ days: [0, 1, 2, 3, 4], common });
        expect(groups).toEqual([{ startTime: '09:00', endTime: '18:00', days: [0, 1, 2, 3, 4] }]);
    });

    it('вторник со своими часами уезжает отдельной группой', () => {
        const groups = groupDaysByHours({
            days: [0, 1, 2], common, perDayEnabled: true,
            perDay: { 1: { startTime: '15:00', endTime: '21:00' } },
        });
        expect(groups).toEqual([
            { startTime: '09:00', endTime: '18:00', days: [0, 2] },
            { startTime: '15:00', endTime: '21:00', days: [1] },
        ]);
    });

    it('дни с совпавшими часами собираются вместе, даже если заданы порознь', () => {
        // Иначе на каждый правленый день уходил бы свой запрос, и правило с
        // семью одинаковыми днями создавалось бы семью проверками пересечений.
        const groups = groupDaysByHours({
            days: [0, 1, 2], common, perDayEnabled: true,
            perDay: {
                0: { startTime: '15:00', endTime: '21:00' },
                2: { startTime: '15:00', endTime: '21:00' },
            },
        });
        expect(groups).toEqual([
            { startTime: '15:00', endTime: '21:00', days: [0, 2] },
            { startTime: '09:00', endTime: '18:00', days: [1] },
        ]);
    });

    it('ни один выбранный день не теряется', () => {
        const days = [0, 1, 2, 3, 4, 5, 6];
        const groups = groupDaysByHours({
            days, common, perDayEnabled: true,
            perDay: { 5: { startTime: '10:00', endTime: '14:00' }, 6: { startTime: '11:00', endTime: '13:00' } },
        });
        expect(groups.flatMap(g => g.days).sort()).toEqual(days);
    });

    it('дни не выбраны — групп нет', () => {
        expect(groupDaysByHours({ days: [], common })).toEqual([]);
    });
});

describe('проверка часов', () => {
    it('правильные часы проходят', () => {
        expect(validateRuleHours({ days: [0, 1], common })).toBeNull();
    });

    it('без дней не сохраняем', () => {
        expect(validateRuleHours({ days: [], common })).toBe('Выберите дни недели');
    });

    it('перевёрнутый день называется по имени', () => {
        const message = validateRuleHours({
            days: [0, 1], common, perDayEnabled: true,
            perDay: { 1: { startTime: '21:00', endTime: '15:00' } },
        });
        expect(message).toContain(WEEKDAY_FULL[1]);
    });

    it('нулевой день недели тоже отклоняется', () => {
        expect(validateRuleHours({ days: [3], common: { startTime: '12:00', endTime: '12:00' } }))
            .toContain(WEEKDAY_FULL[3]);
    });

    it('обед обязан помещаться в КАЖДЫЙ день, а не в общие часы', () => {
        // Ровно то, чем опасны раздельные часы: обед 13:00–14:00 проходит
        // проверку по общим 09:00–18:00 и молча выпадает из вторника
        // 15:00–21:00 — вторник получился бы без обеда.
        const message = validateRuleHours({
            days: [0, 1], common, perDayEnabled: true,
            perDay: { 1: { startTime: '15:00', endTime: '21:00' } },
            hasLunch: true, lunchStart: '13:00', lunchEnd: '14:00',
        });
        expect(message).toContain(WEEKDAY_FULL[1]);
        expect(message).toContain('13:00');
    });

    it('обед внутри всех дней проходит', () => {
        expect(validateRuleHours({
            days: [0, 1], common, perDayEnabled: true,
            perDay: { 1: { startTime: '10:00', endTime: '20:00' } },
            hasLunch: true, lunchStart: '13:00', lunchEnd: '14:00',
        })).toBeNull();
    });

    it('перевёрнутый обед отклоняется', () => {
        expect(validateRuleHours({
            days: [0], common, hasLunch: true, lunchStart: '14:00', lunchEnd: '13:00',
        })).toBe('Некорректное время обеда');
    });

    it('выключенные раздельные часы не мешают сохранить правило', () => {
        // Человек поиграл с раздельными часами, выключил и сохранил. Кривой
        // черновик вторника не должен запрещать сохранение того, что на экране.
        expect(validateRuleHours({
            days: [0, 1], common,
            perDay: { 1: { startTime: '21:00', endTime: '15:00' } },
        })).toBeNull();
    });
});

describe('подпись раскладки', () => {
    it('одни часы на всех — просто часы', () => {
        expect(describeRuleHours({ days: [0, 1, 2], common }, DAY_LABELS)).toBe('09:00–18:00');
    });

    it('разные часы — перечисление по дням', () => {
        expect(describeRuleHours({
            days: [0, 1], common, perDayEnabled: true,
            perDay: { 1: { startTime: '15:00', endTime: '21:00' } },
        }, DAY_LABELS)).toBe('Пн 09:00–18:00 · Вт 15:00–21:00');
    });

    it('без дней подписи нет', () => {
        expect(describeRuleHours({ days: [], common }, DAY_LABELS)).toBe('');
    });
});
