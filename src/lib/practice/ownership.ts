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
