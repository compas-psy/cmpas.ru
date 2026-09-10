// «31 дек.» в карточке клиента, у которого нет ни одной встречи.
//
// nextSessionDate у нового клиента ставится в 9999-12-31 — это метка
// сортировки («не уводи выбор с только что заведённой карточки»), а не дата.
// Метка утекла на экран: в списке печаталось «31 дек.» — день, которого нет
// ни в чьём расписании.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { NEW_CLIENT_SORT_SENTINEL, isSortSentinelDate } from '@/lib/clients/next-session-sentinel';

describe('метка сортировки нового клиента', () => {
    it('узнаётся и как Date, и как строка', () => {
        expect(isSortSentinelDate(NEW_CLIENT_SORT_SENTINEL)).toBe(true);
        expect(isSortSentinelDate('9999-12-31T00:00:00.000Z')).toBe(true);
    });

    it('настоящая дата встречи меткой не считается', () => {
        expect(isSortSentinelDate('2026-12-31T00:00:00.000Z')).toBe(false);
        expect(isSortSentinelDate(new Date('2027-01-01'))).toBe(false);
        expect(isSortSentinelDate(null)).toBe(false);
        expect(isSortSentinelDate('не дата')).toBe(false);
    });

    it('список клиентов не печатает метку как дату', () => {
        const page = readFileSync('src/app/diary/clients/page.tsx', 'utf8');
        expect(page).toContain('!isSortSentinelDate(c.nextSessionDate)');
    });

    it('метка заводится в одном месте — иначе правило показа снова разойдётся', () => {
        const create = readFileSync('src/lib/clients/create.ts', 'utf8');
        expect(create).toContain('NEW_CLIENT_SORT_SENTINEL');
        expect(create).not.toContain("new Date('9999");
    });
});
