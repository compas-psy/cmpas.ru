import { db } from '@/lib/db';

// Task 1 (PRAKTIKA MVP): IDs are not authorization. Every server-side
// read/mutation of a Practice resource must be scoped to the authenticated
// psychologist — never trust an id from a URL/body/form alone. The message
// is intentionally identical to a real "not found": leaking "exists but
// belongs to someone else" is its own information disclosure.

export class OwnershipError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'OwnershipError';
    }
}

export async function requireOwnedClient(psychologistId: string, clientId: string): Promise<void> {
    const client = await db.diaryClient.findFirst({
        where: { id: clientId, psychologistId },
        select: { id: true },
    });
    if (!client) throw new OwnershipError('Клиент не найден');
}

export async function requireOwnedSession(psychologistId: string, sessionId: string): Promise<void> {
    const session = await db.diarySession.findFirst({
        where: { id: sessionId, psychologistId },
        select: { id: true },
    });
    if (!session) throw new OwnershipError('Сессия не найдена');
}

export async function requireOwnedAddress(psychologistId: string, addressId: string): Promise<void> {
    const address = await db.psychologistAddress.findFirst({
        where: { id: addressId, psychologistId },
        select: { id: true },
    });
    if (!address) throw new OwnershipError('Кабинет не найден');
}

/**
 * Кабинет должен принадлежать этому специалисту И быть в работе.
 * Выведенный из работы кабинет — это место, куда клиента больше не зовут:
 * ссылаться на него из действующего правила расписания нельзя так же, как и
 * на чужой (Задача 18, P0-2).
 */
export async function requireOwnedActiveAddress(psychologistId: string, addressId: string): Promise<void> {
    const address = await db.psychologistAddress.findFirst({
        where: { id: addressId, psychologistId },
        select: { id: true, isActive: true },
    });
    if (!address) throw new OwnershipError('Кабинет не найден');
    if (!address.isActive) throw new OwnershipError('Кабинет выведен из работы — выберите другой');
}

/**
 * Единственное место, где решается, какой addressId уйдёт в БД для правила
 * или окна расписания. Все серверные пути записи расписания обязаны звать
 * именно её, а не брать addressId из запроса.
 *
 * - online: кабинета не бывает, поэтому подсунутый addressId не сохраняется;
 * - offline: кабинет обязателен — очная встреча без адреса не встреча;
 * - both: продукт исторически допускает и без кабинета, эта семантика
 *   сохранена; но если кабинет указан, он проверяется наравне с offline.
 *
 * Любой НЕ пустой addressId в любом формате проходит проверку владения и
 * работы: чужой или выведенный из работы кабинет не сохранится никогда.
 */
export async function resolveScheduleAddressId(
    psychologistId: string,
    format: string | null | undefined,
    addressId: string | null | undefined,
): Promise<string | null> {
    const normalizedFormat = format || 'online';
    const value = typeof addressId === 'string' ? addressId.trim() : '';

    if (normalizedFormat === 'online') return null;

    if (!value) {
        if (normalizedFormat === 'offline') {
            throw new OwnershipError('Для очного приёма нужно выбрать кабинет');
        }
        return null;
    }

    await requireOwnedActiveAddress(psychologistId, value);
    return value;
}

export async function requireOwnedCalendarIntegration(psychologistId: string, integrationId: string): Promise<void> {
    const integration = await db.calendarIntegration.findFirst({
        where: { id: integrationId, psychologistId },
        select: { id: true },
    });
    if (!integration) throw new OwnershipError('Интеграция календаря не найдена');
}

export async function requireOwnedScheduleRule(psychologistId: string, ruleId: string): Promise<void> {
    const rule = await db.scheduleRule.findFirst({
        where: { id: ruleId, psychologistId },
        select: { id: true },
    });
    if (!rule) throw new OwnershipError('Правило расписания не найдено');
}

export async function requireOwnedAvailabilitySlot(psychologistId: string, slotId: string): Promise<void> {
    const slot = await db.availabilitySlot.findFirst({
        where: { id: slotId, psychologistId },
        select: { id: true },
    });
    if (!slot) throw new OwnershipError('Слот расписания не найден');
}
