// Связка VisitorAnalytics с аккаунтом при входе/регистрации (задача B5).
// До этого VisitorAnalytics.accountId не существовало вовсе — q_sources
// (funnel.ts) не мог атрибутировать источник аккаунта, потому что
// отпечаток устройства и аккаунт нигде не пересекались.
//
// Правило из charter/13_TRACKING_PLAN.md §2: "Склейка пишется отдельным
// событием identity_linked в момент, когда связь становится известна.
// Задним числом идентификаторы не перезаписываются — иначе вчерашние
// отчёты завтра покажут другие числа". Отсюда: связываем только когда
// accountId ещё не проставлен (первый вход с этого устройства) — если он
// уже указывает на ДРУГОЙ аккаунт (общий компьютер, чужое устройство),
// не перезаписываем и не выдаём это за новую связку.

import type { track as trackFn } from './track';

export type LinkOutcome =
    | 'linked' // связь установлена впервые — именно этот случай событие identity_linked и отмечает
    | 'already_linked' // тот же аккаунт уже был связан — повторный вход, не новость
    | 'conflict' // устройство уже связано с ДРУГИМ аккаунтом — не перезаписываем
    | 'not_found' // такого visitorId нет в VisitorAnalytics (например, блокировщик срезал предыдущий визит)
    | 'no_visitor_id'; // нечем связывать — куки с visitorId нет вовсе

type Db = {
    visitorAnalytics: {
        findUnique: (args: { where: { visitorId: string }; select: { accountId: true } }) => Promise<{ accountId: string | null } | null>;
        update: (args: { where: { visitorId: string }; data: { accountId: string } }) => Promise<unknown>;
    };
};

export async function linkVisitorToAccount(db: Db, visitorId: string | null | undefined, accountId: string): Promise<LinkOutcome> {
    if (!visitorId) return 'no_visitor_id';

    const existing = await db.visitorAnalytics.findUnique({ where: { visitorId }, select: { accountId: true } });
    if (!existing) return 'not_found';
    if (existing.accountId === accountId) return 'already_linked';
    if (existing.accountId !== null) return 'conflict';

    await db.visitorAnalytics.update({ where: { visitorId }, data: { accountId } });
    return 'linked';
}

type TrackDb = Parameters<typeof trackFn>[0];

/**
 * Склеивает связку с отправкой identity_linked: только исход `linked` —
 * первая, настоящая склейка — это событие; повторный вход тем же
 * устройством (`already_linked`) не событие вовсе (13_TRACKING_PLAN.md §2:
 * "пишется... в момент, когда связь СТАНОВИТСЯ известна", не при каждом
 * входе). Вынесено отдельно от src/auth.ts, чтобы поведение проверялось
 * тестом без обвязки next/headers/NextAuth — единственная непроверяемая в
 * этой песочнице часть остаётся тонким чтением cookie в auth.ts.
 */
export async function linkVisitorAndTrackIdentity(
    db: Db & TrackDb,
    track: typeof trackFn,
    visitorId: string | null | undefined,
    accountId: string,
): Promise<LinkOutcome> {
    const outcome = await linkVisitorToAccount(db, visitorId, accountId);
    if (outcome === 'linked') {
        await track(db, { event: 'identity_linked', product: 'practice', accountId, deviceId: visitorId ?? null });
    }
    return outcome;
}
