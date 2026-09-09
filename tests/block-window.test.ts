import { describe, it, expect } from 'vitest';
import {
    resolveBlockWindow,
    sessionOverlapsBlock,
    sessionEndTime,
    isWholeDay,
    blockWindowLabel,
    WHOLE_DAY_START,
    WHOLE_DAY_END,
} from '@/lib/practice/block-window';

/**
 * Блокировка на часы, а не только на дни.
 *
 * Данные это умели всегда: у DiaryBlock есть startTime и endTime, и мобильное
 * приложение их присылало. Не умела форма в вебе — она спрашивала «с какого по
 * какое ЧИСЛО» и молча ставила 00:00–23:59. Специалист, которому нужно закрыть
 * два часа во вторник, закрывал весь вторник.
 *
 * Правило пересечения при этом было написано ровно один раз и только в
 * мобильном маршруте. Веб при отмене пересекающихся сессий на часы не смотрел
 * вовсе: с часовой блокировкой он предложил бы отменить ВЕСЬ день — то есть
 * встречи живых людей, которых блокировка не касается.
 */

describe('окно блокировки', () => {
    it('часы не заданы — целый день, как вело себя веб-действие раньше', () => {
        expect(resolveBlockWindow({})).toEqual({ startTime: WHOLE_DAY_START, endTime: WHOLE_DAY_END });
        expect(isWholeDay(resolveBlockWindow({})!)).toBe(true);
    });

    it('заданные часы принимаются', () => {
        expect(resolveBlockWindow({ startTime: '10:00', endTime: '12:00' }))
            .toEqual({ startTime: '10:00', endTime: '12:00' });
    });

    it('мусор вместо времени не попадает в базу', () => {
        // Иначе в блокировке оказалась бы строка, по которой ничего не
        // сравнивается, и она молча перестала бы закрывать время.
        expect(resolveBlockWindow({ startTime: 'обед', endTime: '25:99' }))
            .toEqual({ startTime: WHOLE_DAY_START, endTime: WHOLE_DAY_END });
    });

    it('конец раньше начала — не окно', () => {
        expect(resolveBlockWindow({ startTime: '12:00', endTime: '10:00' })).toBeNull();
        expect(resolveBlockWindow({ startTime: '12:00', endTime: '12:00' })).toBeNull();
    });

    it('подпись для человека', () => {
        expect(blockWindowLabel({ startTime: WHOLE_DAY_START, endTime: WHOLE_DAY_END })).toBe('весь день');
        expect(blockWindowLabel({ startTime: '10:00', endTime: '12:00' })).toBe('10:00–12:00');
    });
});

describe('конец встречи', () => {
    it('берётся из поля, если оно есть', () => {
        expect(sessionEndTime({ time: '10:00', endTime: '11:30' })).toBe('11:30');
    });

    it('считается по длительности, если поля нет', () => {
        expect(sessionEndTime({ time: '10:00', duration: 90 })).toBe('11:30');
    });

    it('без длительности — 50 минут, как везде в продукте', () => {
        expect(sessionEndTime({ time: '10:00' })).toBe('10:50');
    });
});

describe('попадает ли встреча под блокировку', () => {
    const lunch = { startTime: '13:00', endTime: '14:00' };

    it('встреча внутри окна попадает', () => {
        expect(sessionOverlapsBlock({ time: '13:00', duration: 50 }, lunch)).toBe(true);
    });

    it('встреча, заходящая краем, попадает', () => {
        expect(sessionOverlapsBlock({ time: '12:30', duration: 50 }, lunch)).toBe(true);
    });

    it('касание краями пересечением не считается', () => {
        // Встреча 12:00–13:00 и блокировка 13:00–14:00 стоят рядом. Иначе
        // блокировка обеда предлагала бы отменить встречу, которая к обеду
        // уже закончилась.
        expect(sessionOverlapsBlock({ time: '12:00', duration: 60 }, lunch)).toBe(false);
        expect(sessionOverlapsBlock({ time: '14:00', duration: 50 }, lunch)).toBe(false);
    });

    it('встреча вне окна не попадает', () => {
        expect(sessionOverlapsBlock({ time: '09:00', duration: 50 }, lunch)).toBe(false);
        expect(sessionOverlapsBlock({ time: '18:00', duration: 50 }, lunch)).toBe(false);
    });

    it('при блокировке на весь день попадают все встречи дня', () => {
        const wholeDay = { startTime: WHOLE_DAY_START, endTime: WHOLE_DAY_END };
        expect(sessionOverlapsBlock({ time: '09:00', duration: 50 }, wholeDay)).toBe(true);
        expect(sessionOverlapsBlock({ time: '21:00', duration: 50 }, wholeDay)).toBe(true);
    });
});
