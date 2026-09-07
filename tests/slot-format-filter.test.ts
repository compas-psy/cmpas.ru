// Отбор свободных слотов по формату встречи.
//
// Живой случай: специалист выбрал «В кабинете» и среду, а в «Доступном
// времени» получил восемь слотов, часть которых в расписании настроена как
// онлайновые. Отбора не было ни в приложении, ни в вебе — обе формы записи
// показывали все свободные часы дня подряд.
//
// Правило задано учредителем: свой формат показывается, чужой нет,
// гибридное правило расписания годится обоим.

import { describe, it, expect } from 'vitest';
import { slotMatchesFormat, normalizeSlotFormat, SLOT_OFFLINE, SLOT_ONLINE } from '../src/lib/booking/slot-format';

describe('отбор слотов по формату', () => {
    it('очный выбор не показывает онлайновые слоты', () => {
        expect(slotMatchesFormat('online', 'offline')).toBe(false);
    });

    it('онлайн-выбор не показывает очные слоты', () => {
        expect(slotMatchesFormat('offline', 'online')).toBe(false);
    });

    it('свой формат показывается', () => {
        expect(slotMatchesFormat('online', 'online')).toBe(true);
        expect(slotMatchesFormat('offline', 'offline')).toBe(true);
    });

    it('гибридное правило годится и туда и туда', () => {
        expect(slotMatchesFormat('both', 'online')).toBe(true);
        expect(slotMatchesFormat('both', 'offline')).toBe(true);
    });

    // Словари в системе два: расписание пишет offline, сессия — in_person.
    // Прямое сравнение спрятало бы ВСЕ очные слоты вместо лишних, то есть
    // починка дала бы пустой экран вместо неверного.
    it('in_person и offline — одно и то же', () => {
        expect(slotMatchesFormat('offline', 'in_person')).toBe(true);
        expect(slotMatchesFormat('offline', 'IN_PERSON')).toBe(true);
        expect(normalizeSlotFormat('in_person')).toBe(SLOT_OFFLINE);
    });

    it('неизвестное значение считается онлайном, как и в резолвере', () => {
        expect(normalizeSlotFormat(null)).toBe(SLOT_ONLINE);
        expect(normalizeSlotFormat('что-то')).toBe(SLOT_ONLINE);
    });

    it('на списке слотов дня остаются только подходящие', () => {
        const day = [
            { time: '10:00', format: 'online' },
            { time: '11:00', format: 'online' },
            { time: '17:00', format: 'offline' },
            { time: '18:00', format: 'both' },
        ];
        expect(day.filter(s => slotMatchesFormat(s.format, 'offline')).map(s => s.time))
            .toEqual(['17:00', '18:00']);
        expect(day.filter(s => slotMatchesFormat(s.format, 'online')).map(s => s.time))
            .toEqual(['10:00', '11:00', '18:00']);
    });
});
