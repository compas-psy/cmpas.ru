// «Тот же час через неделю» и «занять слот на срок».
//
// Учредитель на живой сессии: «в карточке клиента нет возможности записать
// клиента на тот же слот через неделю или занять слот на определённый срок».
// Регулярная работа устроена именно так — клиент ходит по вторникам в 14:00,
// и это не решается заново каждую неделю.
//
// Здесь проверяется ядро (src/lib/practice/booking/repeat-slot.ts). Три вещи
// важнее прочих:
//
//   1. час берётся из настоящей встречи целиком — время, длительность,
//      формат, тип, кабинет; иначе «тот же слот» им не будет;
//   2. занимаются только БУДУЩИЕ даты, даже если опорная встреча прошлая;
//   3. отчёт поимённый: занятая третья неделя не отменяет первых двух, и
//      специалист видит, какая дата выпала и почему.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const diarySessionFindFirst = vi.fn();
vi.mock('@/lib/db', () => ({
    db: { diarySession: { findFirst: (...args: unknown[]) => diarySessionFindFirst(...args) } },
}));

class FakeConflict extends Error {
    code: string;
    constructor(code: string, message: string) {
        super(message);
        this.name = 'BookingConflictError';
        this.code = code;
    }
}
const createManualPracticeSession = vi.fn();
vi.mock('@/lib/practice/booking/booking', () => ({
    createManualPracticeSession: (...args: unknown[]) => createManualPracticeSession(...args),
    BookingConflictError: FakeConflict,
}));

/** «Сегодня» в тестах — вторник 8 сентября 2026. */
const NOW = new Date('2026-09-08T09:00:00Z');

function session(over: Record<string, unknown> = {}) {
    return {
        id: 'ref-1',
        date: new Date('2026-09-08T00:00:00Z'), // вторник
        time: '14:00',
        duration: 60,
        type: 'individual',
        format: 'offline',
        addressId: 'cab-1',
        status: 'confirmed',
        ...over,
    };
}

beforeEach(() => {
    vi.clearAllMocks();
    let n = 0;
    createManualPracticeSession.mockImplementation(async () => ({ session: { id: `new-${++n}` }, alreadyExisted: false }));
});

describe('повтор часа клиента', () => {
    it('«через неделю» — ровно одна встреча, ровно на неделю позже', async () => {
        diarySessionFindFirst.mockResolvedValueOnce(session());
        const { repeatClientSlot } = await import('@/lib/practice/booking/repeat-slot');

        const result = await repeatClientSlot({ psychologistId: 'psy-1', clientId: 'cl-1', weeks: 1 }, NOW);

        expect(result.booked).toEqual([{ date: '2026-09-15', time: '14:00', sessionId: 'new-1' }]);
        expect(result.skipped).toEqual([]);
    });

    it('час переносится целиком: длительность, формат, тип и кабинет', async () => {
        diarySessionFindFirst.mockResolvedValueOnce(session());
        const { repeatClientSlot } = await import('@/lib/practice/booking/repeat-slot');

        await repeatClientSlot({ psychologistId: 'psy-1', clientId: 'cl-1', weeks: 1 }, NOW);

        expect(createManualPracticeSession).toHaveBeenCalledWith(expect.objectContaining({
            psychologistId: 'psy-1',
            clientId: 'cl-1',
            dateStr: '2026-09-15',
            time: '14:00',
            duration: 60,
            type: 'individual',
            format: 'offline',
            addressId: 'cab-1',
        }));
    });

    it('«на месяц» — четыре недели подряд, шаг ровно семь дней', async () => {
        diarySessionFindFirst.mockResolvedValueOnce(session());
        const { repeatClientSlot } = await import('@/lib/practice/booking/repeat-slot');

        const result = await repeatClientSlot({ psychologistId: 'psy-1', clientId: 'cl-1', weeks: 4 }, NOW);

        expect(result.booked.map(b => b.date)).toEqual(['2026-09-15', '2026-09-22', '2026-09-29', '2026-10-06']);
    });

    it('опорная встреча прошлая — занимаются только будущие даты', async () => {
        // Ни одной будущей встречи нет, последняя была месяц назад. Занимать
        // прошедшие даты бессмысленно, поэтому шагаем неделями, пока не выйдем
        // за сегодня.
        diarySessionFindFirst.mockResolvedValueOnce(null);
        diarySessionFindFirst.mockResolvedValueOnce(session({ date: new Date('2026-08-11T00:00:00Z') }));
        const { repeatClientSlot } = await import('@/lib/practice/booking/repeat-slot');

        const result = await repeatClientSlot({ psychologistId: 'psy-1', clientId: 'cl-1', weeks: 2 }, NOW);

        expect(result.booked.map(b => b.date)).toEqual(['2026-09-15', '2026-09-22']);
    });

    it('занятая неделя выпадает поимённо, остальные записываются', async () => {
        diarySessionFindFirst.mockResolvedValueOnce(session());
        createManualPracticeSession
            .mockResolvedValueOnce({ session: { id: 'new-1' }, alreadyExisted: false })
            .mockRejectedValueOnce(new FakeConflict('SLOT_UNAVAILABLE', 'Это время уже занято другой сессией.'))
            .mockResolvedValueOnce({ session: { id: 'new-3' }, alreadyExisted: false });
        const { repeatClientSlot } = await import('@/lib/practice/booking/repeat-slot');

        const result = await repeatClientSlot({ psychologistId: 'psy-1', clientId: 'cl-1', weeks: 3 }, NOW);

        expect(result.booked.map(b => b.date)).toEqual(['2026-09-15', '2026-09-29']);
        expect(result.skipped).toEqual([
            { date: '2026-09-22', time: '14:00', reason: 'Это время уже занято другой сессией.' },
        ]);
    });

    it('не-конфликтная ошибка не прячется под видом пропуска', async () => {
        // Пропуск означает «час занят». Упавшая база — не это, и делать вид,
        // что специалист просто неудачно выбрал время, нельзя.
        diarySessionFindFirst.mockResolvedValueOnce(session());
        createManualPracticeSession.mockRejectedValueOnce(new Error('connection lost'));
        const { repeatClientSlot } = await import('@/lib/practice/booking/repeat-slot');

        await expect(repeatClientSlot({ psychologistId: 'psy-1', clientId: 'cl-1', weeks: 2 }, NOW))
            .rejects.toThrow('connection lost');
    });

    it('свой срок задаётся числом, а не выбором из четырёх кнопок', async () => {
        // Учредитель: «по неделям нужно более гибко, например, 4, 8, 12,
        // предложить своё». Кнопки-подсказки не должны быть всем выбором:
        // «до Нового года» в три числа не укладывается.
        diarySessionFindFirst.mockResolvedValue(session());
        const { repeatClientSlot, REPEAT_WEEK_PRESETS, MAX_REPEAT_WEEKS } = await import('@/lib/practice/booking/repeat-slot');

        const own = await repeatClientSlot({ psychologistId: 'psy-1', clientId: 'cl-1', weeks: 17 }, NOW);

        expect(own.booked).toHaveLength(17);
        expect(REPEAT_WEEK_PRESETS.map(p => p.weeks)).not.toContain(17);
        expect(MAX_REPEAT_WEEKS).toBeGreaterThanOrEqual(17);
    });

    it('срок ограничен сверху и снизу', async () => {
        diarySessionFindFirst.mockResolvedValue(session());
        const { repeatClientSlot, MAX_REPEAT_WEEKS } = await import('@/lib/practice/booking/repeat-slot');

        const many = await repeatClientSlot({ psychologistId: 'psy-1', clientId: 'cl-1', weeks: 999 }, NOW);
        expect(many.booked).toHaveLength(MAX_REPEAT_WEEKS);

        createManualPracticeSession.mockClear();
        const none = await repeatClientSlot({ psychologistId: 'psy-1', clientId: 'cl-1', weeks: 0 }, NOW);
        expect(none.booked).toHaveLength(1);
    });

    it('у клиента нет ни одной встречи — повторять нечего, и это сказано прямо', async () => {
        diarySessionFindFirst.mockResolvedValue(null);
        const { repeatClientSlot, NoReferenceSessionError } = await import('@/lib/practice/booking/repeat-slot');

        await expect(repeatClientSlot({ psychologistId: 'psy-1', clientId: 'cl-1', weeks: 1 }, NOW))
            .rejects.toBeInstanceOf(NoReferenceSessionError);
        expect(createManualPracticeSession).not.toHaveBeenCalled();
    });

    it('чужая встреча опорной не станет', async () => {
        // fromSessionId ищется вместе с psychologistId и clientId: указать
        // чужой идентификатор и занять по нему час нельзя.
        diarySessionFindFirst.mockResolvedValue(null);
        const { repeatClientSlot, NoReferenceSessionError } = await import('@/lib/practice/booking/repeat-slot');

        await expect(repeatClientSlot({ psychologistId: 'psy-1', clientId: 'cl-1', weeks: 1, fromSessionId: 'alien' }, NOW))
            .rejects.toBeInstanceOf(NoReferenceSessionError);
        expect(diarySessionFindFirst).toHaveBeenCalledWith({
            where: { id: 'alien', psychologistId: 'psy-1', clientId: 'cl-1' },
        });
    });
});
