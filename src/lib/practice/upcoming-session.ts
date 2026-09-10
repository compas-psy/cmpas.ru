import { db } from '@/lib/db';
import { compareSessionStart, isSessionFuture } from '@/lib/session-maintenance';

/**
 * БЛИЖАЙШАЯ ПРЕДСТОЯЩАЯ ВСТРЕЧА КЛИЕНТА.
 *
 * ЖИВОЙ СЛУЧАЙ, 10.09.2026. Учредитель завёл встречу на сегодня, отметил её,
 * записал клиента снова на завтра — и клиент получил на каждую запись ВТОРОЕ
 * сообщение, где стояло «Подтверждаю запись … 15 июня 2026 г. в 14:00».
 * Пятнадцатое июня — это первая встреча этого клиента, трёхмесячной давности.
 *
 * Причина была буквально в одной строке, повторённой в четырёх местах:
 *
 *     findFirst({ where: { clientId, ... }, orderBy: { date: 'asc' } })
 *
 * без всякого условия на дату. То есть выбиралась САМАЯ РАННЯЯ встреча за всю
 * историю. Для нового клиента, у которого встреча одна, это работало и
 * выглядело правильным — а для любого, кто ходит не первый месяц, всегда
 * называло давно прошедшую дату.
 *
 * Четыре копии одного запроса — и ошибка была во всех четырёх сразу. Поэтому
 * здесь одна функция, а не пятая копия: сравнение «предстоящая ли» живёт в
 * session-maintenance.ts и учитывает не только день, но и время — встреча
 * сегодня в 13:00, когда на часах 15:00, предстоящей уже не является.
 */
export interface UpcomingSessionQuery {
    psychologistId: string;
    clientId: string;
}

/**
 * Возвращает ближайшую встречу клиента, которая ещё не началась, или null.
 *
 * Отменённые не в счёт: их время освобождено, и говорить о них клиенту как о
 * предстоящей встрече было бы неправдой.
 */
export async function findUpcomingSessionForClient(params: UpcomingSessionQuery, now: Date = new Date()) {
    // Берём от начала сегодняшнего дня: встречу, которая сегодня вечером, из
    // выборки терять нельзя, а точное «уже началась или нет» решает время.
    const dayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

    const candidates = await db.diarySession.findMany({
        where: {
            clientId: params.clientId,
            psychologistId: params.psychologistId,
            status: { not: 'cancelled' },
            date: { gte: dayStart },
        },
        orderBy: [{ date: 'asc' }, { time: 'asc' }],
        take: 20,
    });

    return candidates.filter((session) => isSessionFuture(session, now)).sort(compareSessionStart)[0] ?? null;
}

/** Есть ли клиенту о какой встрече напоминать. */
export async function hasUpcomingSessionForClient(params: UpcomingSessionQuery, now: Date = new Date()): Promise<boolean> {
    return (await findUpcomingSessionForClient(params, now)) !== null;
}
