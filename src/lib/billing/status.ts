import { db } from '@/lib/db';

/**
 * Состояние оплаты: одно вычисление на веб и приложение.
 *
 * Раньше вывод «подписка активна» делал экран, а сервер отдавал только
 * дату окончания. Экран делал из даты вывод «раз дата есть — значит
 * активна», и подписка, кончившаяся в мае, в сентябре показывалась
 * активной. Правило «активна» живёт здесь, в одном месте, и оба клиента
 * получают готовый ответ, а не исходник для собственных выводов.
 */
export type BillingStatus = {
    /** Сколько дней осталось у действующего периода (триала или подписки). */
    daysLeft: number | null;
    isExpired: boolean;
    /** Бессрочный бесплатный доступ. */
    isForever: boolean;
    /** Оплачено И срок ещё не вышел. */
    subscriptionActive: boolean;
    subscriptionEndsAt: string | null;
    subscriptionPlan: string | null;
    /** Идёт пробный период: подписки нет, но срок триала ещё не вышел. */
    trialActive: boolean;
    trialEndsAt: string | null;
};

export const EMPTY_BILLING_STATUS: BillingStatus = {
    daysLeft: null,
    isExpired: false,
    isForever: false,
    subscriptionActive: false,
    subscriptionEndsAt: null,
    subscriptionPlan: null,
    trialActive: false,
    trialEndsAt: null,
};

/**
 * Читается сырым запросом, а не через модель: колонки триала и подписки
 * появились миграцией позже клиента Prisma в части сред, и обычное чтение
 * там падает целиком — вместе с экраном, который без него обошёлся бы.
 */
export async function readBillingStatus(userId: string, now: Date = new Date()): Promise<BillingStatus> {
    try {
        const rows = await db.$queryRaw<{
            trialEndsAt: Date | null;
            subscriptionEndsAt: Date | null;
            subscriptionPlan: string | null;
        }[]>`
            SELECT "trialEndsAt", "subscriptionEndsAt", "subscriptionPlan"
            FROM "User" WHERE id = ${userId} LIMIT 1
        `;
        const user = rows[0];
        if (!user) return EMPTY_BILLING_STATUS;
        return computeBillingStatus(user, now);
    } catch {
        return EMPTY_BILLING_STATUS;
    }
}

/** Само правило, отдельно от чтения: его и проверяют тесты. */
export function computeBillingStatus(
    user: { trialEndsAt: Date | null; subscriptionEndsAt: Date | null; subscriptionPlan: string | null },
    now: Date = new Date(),
): BillingStatus {
    const trialEndsAt = user.trialEndsAt ? new Date(user.trialEndsAt) : null;
    const subscriptionEndsAt = user.subscriptionEndsAt ? new Date(user.subscriptionEndsAt) : null;

    // Бессрочный доступ помечен датой за горизонтом, а не отдельным флагом.
    const isForever = !!trialEndsAt && trialEndsAt.getFullYear() >= 2099;
    const hasActiveSub = !!subscriptionEndsAt && subscriptionEndsAt > now;
    const trialActive = !hasActiveSub && !!trialEndsAt && trialEndsAt > now;

    // ЧТО СЧИТАЕТСЯ «КОНЦОМ ДОСТУПА», КОГДА ДАТ ДВЕ.
    //
    // Прежнее правило брало дату триала всегда, когда подписка не активна, —
    // и у человека с истёкшей подпиской, но БЕЗ даты триала (оплатил сразу,
    // не пробуя) конец доступа получался null. То есть «подписка
    // закончилась» ему не показывалось вовсе: экран выглядел так, будто
    // всё в порядке, а работать было уже нельзя.
    //
    // Правильный конец — позднейшая из известных дат: она и решает, кончился
    // ли доступ.
    const candidates = [trialEndsAt, subscriptionEndsAt].filter((d): d is Date => d !== null);
    const effectiveEnd = hasActiveSub
        ? subscriptionEndsAt
        : candidates.length > 0
            ? new Date(Math.max(...candidates.map(d => d.getTime())))
            : null;
    const isExpired = effectiveEnd ? effectiveEnd < now : false;
    const daysLeft = effectiveEnd
        ? Math.max(0, Math.ceil((effectiveEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
        : null;

    return {
        daysLeft: isForever ? null : daysLeft,
        subscriptionActive: hasActiveSub,
        isExpired: isForever ? false : isExpired,
        isForever,
        subscriptionEndsAt: subscriptionEndsAt ? subscriptionEndsAt.toISOString() : null,
        subscriptionPlan: user.subscriptionPlan,
        trialActive: isForever ? false : trialActive,
        trialEndsAt: trialEndsAt ? trialEndsAt.toISOString() : null,
    };
}
