// Карточка клиента переставала открываться — но не у всех.
//
//     TypeError: e.date.localeCompare is not a function
//
// Код сортировал встречи как строки: `a.date.localeCompare(b.date)`. Серверное
// действие отдаёт то, что пришло из базы, а там `date` — объект Date;
// сериализация серверных действий даты СОХРАНЯЕТ. У Date нет localeCompare.
//
// Почему не у всех: Array.prototype.sort зовёт сравнение только при двух и
// более элементах. У клиента с одной будущей встречей ошибки не было вовсе;
// ждала она тех, у кого встреч несколько, — постоянных клиентов и тех, кому
// только что заняли час на срок. Самая нужная карточка ломалась первой.
//
// Учредитель: «не открываются только Мартынов Илья, Мартынова Ирина, Сударев
// Максим, Мартынов Артем и Александр» — ровно те, с кем он работает чаще.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { sessionDayKey, compareByDayThenTime } from '@/lib/practice/session-day';

describe('ключ дня встречи', () => {
    it('строка и Date дают один ключ', () => {
        expect(sessionDayKey('2026-09-17')).toBe('2026-09-17');
        expect(sessionDayKey('2026-09-17T00:00:00.000Z')).toBe('2026-09-17');
        expect(sessionDayKey(new Date('2026-09-17T00:00:00.000Z'))).toBe('2026-09-17');
    });

    it('пустое и негодное не роняют сравнение', () => {
        expect(sessionDayKey(null)).toBe('');
        expect(sessionDayKey(undefined)).toBe('');
        expect(sessionDayKey(new Date('не дата'))).toBe('');
    });

    it('сортировка Date-ов больше не падает — ради этого всё и делалось', () => {
        const sessions = [
            { date: new Date('2026-09-24T00:00:00.000Z'), time: '14:00' },
            { date: new Date('2026-09-10T00:00:00.000Z'), time: '14:00' },
            { date: new Date('2026-09-17T00:00:00.000Z'), time: '14:00' },
        ];

        const sorted = [...sessions].sort(compareByDayThenTime);

        expect(sorted.map(s => sessionDayKey(s.date))).toEqual(['2026-09-10', '2026-09-17', '2026-09-24']);
    });

    it('в один день — раньше тот, кто раньше по часу', () => {
        const day = new Date('2026-09-17T00:00:00.000Z');
        const sorted = [{ date: day, time: '18:00' }, { date: day, time: '11:00' }].sort(compareByDayThenTime);
        expect(sorted[0].time).toBe('11:00');
    });

    it('строки и Date можно сравнивать друг с другом', () => {
        // Список и карточка приходят разными путями; смешанный массив не
        // должен зависеть от того, каким именно.
        const sorted = [
            { date: new Date('2026-09-24T00:00:00.000Z'), time: '14:00' },
            { date: '2026-09-10', time: '14:00' },
        ].sort(compareByDayThenTime);
        expect(sessionDayKey(sorted[0].date)).toBe('2026-09-10');
    });
});

describe('старый приём не вернулся', () => {
    it('ни один экран кабинета не сравнивает даты как строки', () => {
        for (const file of [
            'src/app/diary/clients/page.tsx',
            'src/app/diary/page.tsx',
            'src/app/diary/calendar/page.tsx',
        ]) {
            const source = readFileSync(file, 'utf8');
            expect(source, `${file}: date.localeCompare падает, когда date — Date`)
                .not.toMatch(/\.date\.localeCompare\(/);
        }
    });
});
