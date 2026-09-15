// «Кто заводит запись» молчал не потому, что данных нет.
//
// Причина в коде гласила: «нужно добавить поле `createdBy` в модель
// `DiarySession` — сейчас признак автора негде хранить». Признак появился
// раньше — `DiarySession.origin` (Задача 9, разбор учредителя 03.09.2026):
// ядро записи пишет туда `manual` или `self_booking`, импорт — свои значения.
// Блок при этом продолжал отвечать `no_data` с устаревшим объяснением, то
// есть панель рассказывала учредителю, почему она не может показать то, что
// уже могла.
//
// Тест держит ПОВЕДЕНИЕ, а не реализацию: доля самозаписи считается по
// origin, а записи из импорта в знаменатель не входят — они не говорят ни о
// клиенте, ни о специалисте, и смешивать их с долей самозаписи значит её
// портить.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const groupBy = vi.fn();
vi.mock('@/lib/db', () => ({ db: { diarySession: { groupBy: (...a: unknown[]) => groupBy(...a) } } }));

import { qPracticeBookingAuthor } from '@/lib/panel/queries/products';

beforeEach(() => groupBy.mockReset());

const rows = (counts: Record<string, number>) =>
    Object.entries(counts).map(([origin, n]) => ({ origin, _count: { _all: n } }));

describe('q_practice_booking_author считается по DiarySession.origin', () => {
    it('делит записи на самозапись и руками специалиста', async () => {
        groupBy.mockResolvedValue(rows({ self_booking: 3, manual: 1 }));

        const block = await qPracticeBookingAuthor();
        expect(block.state).toBe('ok');
        if (block.state !== 'ok' || !block.data) throw new Error('ожидались данные');
        expect(block.data.selfRate).toBe(75);
        expect(block.data.self).toBe(3);
        expect(block.data.manual).toBe(1);
    });

    it('импорт не входит в знаменатель доли самозаписи', async () => {
        // 1 самозапись, 1 руками, 98 импортом. Доля самозаписи — 50 %, а не 1 %:
        // импортированная строка не говорит о том, кто записал человека.
        groupBy.mockResolvedValue(rows({ self_booking: 1, manual: 1, calendar_import: 98 }));

        const block = await qPracticeBookingAuthor();
        expect(block.state).toBe('ok');
        if (block.state !== 'ok' || !block.data) throw new Error('ожидались данные');
        expect(block.data.selfRate).toBe(50);
        expect(block.data.imported).toBe(98);
        expect(block.data.total).toBe(100);
    });

    it('записей за окно не было — честное no_data, а не ноль процентов', async () => {
        groupBy.mockResolvedValue([]);

        const block = await qPracticeBookingAuthor();
        expect(block.state).toBe('no_data');
    });

    it('все записи пришли импортом — тоже no_data: автора среди них нет', async () => {
        groupBy.mockResolvedValue(rows({ calendar_import: 12, spreadsheet_import: 3 }));

        const block = await qPracticeBookingAuthor();
        expect(block.state).toBe('no_data');
    });

    it('причина `no_data` больше не ссылается на несуществующее поле createdBy', async () => {
        groupBy.mockResolvedValue([]);

        const block = await qPracticeBookingAuthor();
        if (block.state !== 'no_data') throw new Error('ожидалось no_data');
        expect(block.reason).not.toContain('createdBy');
    });
});
