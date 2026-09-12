/**
 * Удаление карточки клиента — ядро без сессии.
 *
 * Вынесено из server action (`src/app/diary/actions/clients.ts`), потому что
 * то же самое должно делать приложение: там сессии нет, есть Bearer-токен, и
 * вызвать action оттуда нельзя. Копировать зачистку в маршрут значило бы
 * завести второе место, где её можно забыть обновить, — а забытая строка
 * здесь оставляет за удалённым человеком его приглашения и запланированные
 * сообщения.
 */

import { db } from '@/lib/db';

/**
 * Удалить карточку и всё, что на неё ссылается без каскада.
 *
 * ВЛАДЕЛЕЦ ПРОВЕРЯЕТСЯ ДО ЛЮБОЙ ЗАЧИСТКИ. `ClientInviteToken` и
 * `ScheduledClientMessage` живут вне связей Prisma, и удаление в них идёт по
 * одному лишь `clientId`: сделай это раньше проверки — и специалист А смог
 * бы стереть приглашения клиента специалиста Б, зная только идентификатор,
 * хотя сама карточка (она сужена по `psychologistId`) при этом уцелела бы.
 *
 * @returns была ли карточка наша. `false` значит «её нет или она чужая» —
 *          наружу эти два случая не различаются намеренно.
 */
export async function deleteClientRecord(psychologistId: string, clientId: string): Promise<boolean> {
    const owned = await db.diaryClient.findFirst({
        where: { id: clientId, psychologistId },
        select: { id: true },
    });
    if (!owned) return false;

    try {
        await db.$executeRaw`DELETE FROM "ClientInviteToken" WHERE "clientId" = ${clientId}`;
        await db.$executeRaw`DELETE FROM "ScheduledClientMessage" WHERE "clientId" = ${clientId}`;
    } catch {
        // Таблиц может не быть в отдельных окружениях — это не повод не
        // удалять саму карточку.
    }

    // Удаление сужено по владельцу ВТОРОЙ раз, хотя владелец уже проверен:
    // между проверкой и удалением карточка могла смениться, и цена лишнего
    // условия здесь — ничто против чужой стёртой карточки.
    await db.diaryClient.deleteMany({ where: { id: clientId, psychologistId } });
    return true;
}
