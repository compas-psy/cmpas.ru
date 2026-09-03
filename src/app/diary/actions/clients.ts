'use server';

import { db } from '@/lib/db';
import { auth } from '@/auth';
import { revalidatePath } from 'next/cache';
import { fetchGoogleCalendarEvents } from '@/lib/calendar/google';
import { fetchYandexCalendarEvents } from '@/lib/calendar/yandex';
import { aggregateCandidates, type CandidateClient } from '@/lib/clients/extract-name';
import { clientBookingLink } from '@/lib/client-workflow';
import { getPsychologistBookingUrl } from '@/lib/booking/slug';
import { requireOwnedClient, requireOwnedSession } from '@/lib/practice/ownership';
import { requirePracticeOperatorAttestation } from '@/lib/practice/attestation';

async function getPsychologistId() {
    const session = await auth();
    if (!session?.user?.id) throw new Error('Unauthorized');
    return session.user.id;
}

/** Signed, time-limited personal booking link for one client — safe to share, not forgeable. */
export async function getClientBookingLink(clientId: string) {
    const psychologistId = await getPsychologistId();
    const client = await db.diaryClient.findFirst({ where: { id: clientId, psychologistId }, select: { id: true } });
    if (!client) throw new Error('Клиент не найден');
    // §5.1 (O-260829): human-readable /u/<slug> base instead of the raw id.
    const base = await getPsychologistBookingUrl(psychologistId);
    return clientBookingLink(psychologistId, client.id, base);
}

export async function getClients(search?: string, statusFilter?: string) {
    const psychologistId = await getPsychologistId();
    return db.diaryClient.findMany({
        where: {
            psychologistId,
            ...(statusFilter && statusFilter !== 'all' ? { status: statusFilter } : {}),
            ...(search ? {
                OR: [
                    { name: { contains: search, mode: 'insensitive' as const } },
                    { questionnaire: { data: { path: ['fullName'], string_contains: search } } },
                ],
            } : {}),
        },
        include: {
            questionnaire: true,
            sessions: {
                where: { status: { not: 'cancelled' } },
                orderBy: { date: 'asc' },
                select: { id: true, date: true, time: true, status: true },
                take: 5,
            },
        },
        orderBy: { updatedAt: 'desc' },
    });
}

export async function getClient(id: string) {
    const psychologistId = await getPsychologistId();
    return db.diaryClient.findFirst({
        where: { id, psychologistId },
        include: {
            questionnaire: true,
            sessions: { orderBy: { date: 'desc' } },
        },
    });
}

export async function createClient(data: {
    name: string;
    phone?: string;
    email?: string;
    dateOfBirth?: string;
    age?: number;
    gender?: string;
}) {
    const psychologistId = await getPsychologistId();
    await requirePracticeOperatorAttestation(psychologistId);
    const client = await db.diaryClient.create({
        data: {
            psychologistId,
            name: data.name,
            phone: data.phone || null,
            email: data.email || null,
            dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : null,
            age: data.age || null,
            gender: data.gender || null,
            // UI uses nextSessionDate only to auto-select the most relevant client
            // when no card is selected. For a just-created client we want the new card
            // to stay selected until the psychologist creates the first session,
            // instead of jumping to the client with the latest old session.
            nextSessionDate: new Date('9999-12-31T00:00:00.000Z'),
        },
    });
    revalidatePath('/diary');
    revalidatePath('/diary/clients');
    return client;
}

export async function updateClient(id: string, data: Record<string, unknown>) {
    const psychologistId = await getPsychologistId();
    await requireOwnedClient(psychologistId, id);
    const client = await db.diaryClient.update({
        where: { id },
        data: { ...data, psychologistId },
    });
    revalidatePath('/diary');
    revalidatePath('/diary/clients');
    return client;
}

export async function archiveClient(id: string) {
    const psychologistId = await getPsychologistId();
    await requireOwnedClient(psychologistId, id);
    await db.diaryClient.update({
        where: { id },
        data: { status: 'archived' },
    });
    revalidatePath('/diary/clients');
}

export async function restoreClient(id: string) {
    const psychologistId = await getPsychologistId();
    await requireOwnedClient(psychologistId, id);
    await db.diaryClient.update({
        where: { id },
        data: { status: 'active' },
    });
    revalidatePath('/diary/clients');
}

export async function deleteClient(id: string) {
    const psychologistId = await getPsychologistId();
    await requireOwnedClient(psychologistId, id);

    // Standalone tables (ClientInviteToken, ScheduledClientMessage) reference
    // clientId without a Prisma relation/cascade, so they would otherwise be
    // orphaned or block deletion. Clean them up explicitly first — but only
    // after ownership is confirmed above: these are raw deletes keyed by
    // clientId alone, so running them before the check would let psychologist
    // A wipe another psychologist's client's invite/message rows just by
    // knowing their clientId, even though the DiaryClient row itself would
    // survive (already correctly scoped below).
    try {
        await db.$executeRaw`DELETE FROM "ClientInviteToken" WHERE "clientId" = ${id}`;
        await db.$executeRaw`DELETE FROM "ScheduledClientMessage" WHERE "clientId" = ${id}`;
    } catch {
        // Tables may not exist in some environments — ignore.
    }

    await db.diaryClient.deleteMany({ where: { id, psychologistId } });
    revalidatePath('/diary');
    revalidatePath('/diary/clients');
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function saveQuestionnaire(clientId: string, data: any) {
    const psychologistId = await getPsychologistId();
    await requireOwnedClient(psychologistId, clientId);
    const result = await db.diaryQuestionnaire.upsert({
        where: { clientId },
        create: { clientId, data },
        update: { data },
    });
    revalidatePath('/diary/clients');
    return result;
}

export async function updateSessionNotes(sessionId: string, notes: string) {
    const psychologistId = await getPsychologistId();
    await requireOwnedSession(psychologistId, sessionId);
    await db.diarySession.update({
        where: { id: sessionId },
        data: { notes },
    });
    revalidatePath('/diary/clients');
}

// Массовое создание клиентов — из вставки списком или из сканирования календаря.
// Пропускает дубликаты по имени (case-insensitive) в пределах существующих клиентов психолога.
export async function bulkCreateClients(
    items: { name: string; phone?: string; email?: string }[]
): Promise<{ created: number; skipped: number }> {
    const psychologistId = await getPsychologistId();
    if (!Array.isArray(items) || items.length === 0) {
        return { created: 0, skipped: 0 };
    }
    await requirePracticeOperatorAttestation(psychologistId);

    // Берём существующих, чтобы не плодить дубликаты
    const existing = await db.diaryClient.findMany({
        where: { psychologistId },
        select: { name: true, phone: true, email: true },
    });
    const existingKeys = new Set(
        existing.map(c => (c.name || '').trim().toLowerCase())
    );
    const existingPhones = new Set(
        existing.map(c => (c.phone || '').replace(/\D/g, '')).filter(Boolean)
    );
    const existingEmails = new Set(
        existing.map(c => (c.email || '').toLowerCase()).filter(Boolean)
    );

    let created = 0;
    let skipped = 0;
    const seenInBatch = new Set<string>();

    for (const raw of items) {
        const name = (raw.name || '').trim();
        if (!name || name.length < 2) {
            skipped++;
            continue;
        }
        const key = name.toLowerCase();
        if (seenInBatch.has(key) || existingKeys.has(key)) {
            skipped++;
            continue;
        }
        const phoneDigits = (raw.phone || '').replace(/\D/g, '');
        if (phoneDigits && existingPhones.has(phoneDigits)) {
            skipped++;
            continue;
        }
        const emailLower = (raw.email || '').toLowerCase();
        if (emailLower && existingEmails.has(emailLower)) {
            skipped++;
            continue;
        }

        await db.diaryClient.create({
            data: {
                psychologistId,
                name,
                phone: raw.phone || null,
                email: raw.email || null,
            },
        });
        seenInBatch.add(key);
        if (phoneDigits) existingPhones.add(phoneDigits);
        if (emailLower) existingEmails.add(emailLower);
        created++;
    }

    revalidatePath('/diary');
    revalidatePath('/diary/clients');
    return { created, skipped };
}

// Сканирование подключённого календаря за N последних дней.
// Возвращает кандидатов-клиентов (повторяющиеся имена из заголовков событий).
export async function scanCalendarForClients(
    integrationId: string,
    days: number = 90
): Promise<{ success: boolean; candidates?: CandidateClient[]; error?: string }> {
    const psychologistId = await getPsychologistId();

    const integration = await db.calendarIntegration.findFirst({
        where: { id: integrationId, psychologistId, isActive: true },
    });
    if (!integration) {
        return { success: false, error: 'Календарь не подключён или отключён' };
    }

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    let result: { success: boolean; events?: { start: Date; end: Date; summary: string }[]; error?: string };

    if (integration.provider === 'google') {
        result = await fetchGoogleCalendarEvents(integrationId, startDate, endDate, { includeCompasEvents: true });
    } else if (integration.provider === 'yandex') {
        result = await fetchYandexCalendarEvents(integrationId, startDate, endDate);
    } else {
        return { success: false, error: 'Неподдерживаемый провайдер' };
    }

    if (!result.success || !result.events) {
        return { success: false, error: result.error || 'Не удалось получить события' };
    }

    const candidates = aggregateCandidates(result.events);
    return { success: true, candidates };
}

// Список подключённых календарей — для UI импорта
export async function getConnectedCalendars() {
    const psychologistId = await getPsychologistId();
    return db.calendarIntegration.findMany({
        where: { psychologistId, isActive: true },
        select: { id: true, provider: true, accountEmail: true },
        orderBy: { createdAt: 'asc' },
    });
}
