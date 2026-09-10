// Клиенту говорят про БЛИЖАЙШУЮ встречу, а не про первую в его истории.
//
// ЖИВОЙ СЛУЧАЙ, 10.09.2026. Учредитель завёл встречу на сегодня, отметил её,
// записал клиента снова на завтра — и на каждую запись клиент получил второе
// сообщение: «Подтверждаю запись … 15 июня 2026 г. в 14:00». Пятнадцатое июня
// — первая встреча этого клиента, трёхмесячной давности.
//
// Причина была в одной строке, повторённой в четырёх местах:
// findFirst({ orderBy: { date: 'asc' } }) без всякого условия на дату. Для
// нового клиента с единственной встречей это работало и выглядело правильным.
// Для любого постоянного — всегда называло самую старую дату.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const findMany = vi.fn();
vi.mock('@/lib/db', () => ({ db: { diarySession: { findMany: (...args: unknown[]) => findMany(...args) } } }));

/** Сейчас — 10 сентября 2026, 15:00. */
const NOW = new Date('2026-09-10T15:00:00');

function session(date: string, time: string, over: Record<string, unknown> = {}) {
    return { id: `${date} ${time}`, date: new Date(`${date}T00:00:00`), time, status: 'confirmed', ...over };
}

beforeEach(() => vi.clearAllMocks());

describe('ближайшая предстоящая встреча клиента', () => {
    it('берётся ближайшая будущая, а не самая ранняя в истории', async () => {
        // Ровно живой случай: в базе есть июньская встреча и завтрашняя.
        findMany.mockResolvedValue([session('2026-09-11', '14:00')]);
        const { findUpcomingSessionForClient } = await import('@/lib/practice/upcoming-session');

        const found = await findUpcomingSessionForClient({ psychologistId: 'psy-1', clientId: 'cl-1' }, NOW);

        expect(found?.id).toBe('2026-09-11 14:00');
    });

    it('прошедшие даты в выборку не запрашиваются вовсе', async () => {
        findMany.mockResolvedValue([]);
        const { findUpcomingSessionForClient } = await import('@/lib/practice/upcoming-session');

        await findUpcomingSessionForClient({ psychologistId: 'psy-1', clientId: 'cl-1' }, NOW);

        const where = findMany.mock.calls[0][0].where;
        expect(where.date.gte).toEqual(new Date(Date.UTC(2026, 8, 10)));
        expect(where.status).toEqual({ not: 'cancelled' });
    });

    it('встреча сегодня, но уже начавшаяся, предстоящей не считается', async () => {
        // Именно она и была у учредителя: сегодня в 13:00, а на часах 15:00.
        // По дню она проходит, по времени — нет.
        findMany.mockResolvedValue([session('2026-09-10', '13:00'), session('2026-09-11', '14:00')]);
        const { findUpcomingSessionForClient } = await import('@/lib/practice/upcoming-session');

        const found = await findUpcomingSessionForClient({ psychologistId: 'psy-1', clientId: 'cl-1' }, NOW);

        expect(found?.id).toBe('2026-09-11 14:00');
    });

    it('встреча сегодня вечером — ещё предстоящая', async () => {
        findMany.mockResolvedValue([session('2026-09-10', '19:00'), session('2026-09-11', '14:00')]);
        const { findUpcomingSessionForClient } = await import('@/lib/practice/upcoming-session');

        const found = await findUpcomingSessionForClient({ psychologistId: 'psy-1', clientId: 'cl-1' }, NOW);

        expect(found?.id).toBe('2026-09-10 19:00');
    });

    it('впереди ничего — null, а не старая встреча', async () => {
        findMany.mockResolvedValue([]);
        const { findUpcomingSessionForClient } = await import('@/lib/practice/upcoming-session');

        expect(await findUpcomingSessionForClient({ psychologistId: 'psy-1', clientId: 'cl-1' }, NOW)).toBeNull();
    });

    it('о чём напоминать — есть или нет', async () => {
        const { hasUpcomingSessionForClient } = await import('@/lib/practice/upcoming-session');

        findMany.mockResolvedValue([session('2026-09-11', '14:00')]);
        expect(await hasUpcomingSessionForClient({ psychologistId: 'psy-1', clientId: 'cl-1' }, NOW)).toBe(true);

        // Только сегодняшняя, уже прошедшая: напоминать не о чем, и
        // переключатель «уведомление о записи» предлагать незачем.
        findMany.mockResolvedValue([session('2026-09-10', '13:00')]);
        expect(await hasUpcomingSessionForClient({ psychologistId: 'psy-1', clientId: 'cl-1' }, NOW)).toBe(false);
    });
});
