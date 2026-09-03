'use server';

import { db } from '@/lib/db';
import { auth } from '@/auth';
import { revalidatePath } from 'next/cache';
import { clientBookingLink } from '@/lib/client-workflow';
import { getPsychologistBookingUrl } from '@/lib/booking/slug';
import { requireOwnedClient, requireOwnedSession } from '@/lib/practice/ownership';
import { requirePracticeOperatorAttestation } from '@/lib/practice/attestation';
import { matchClientIdentity, type ClientIdentity } from '@/lib/clients/match';

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

export interface BulkCreateReviewItem {
    name: string;
    status: 'review';
    reason: 'NAME_ONLY_COLLISION';
    suggestedClientIds: string[];
}

// Массовое создание клиентов — из вставки списком или из сканирования календаря.
//
// Task 11 (founder correction): this used to treat a case-insensitive name
// match against an existing client as a duplicate and silently skip it —
// exactly the name-only auto-match the correction banned (two different
// people can share a name; a psychologist correcting a card would silently
// re-merge future imports into the wrong one). Only a strong identifier
// (exact phone or email match, via the same matchClientIdentity used by
// calendar import) is a safe automatic duplicate. A name-only collision is
// neither created as a duplicate person nor silently merged — it comes back
// as a structured `review` entry for the caller UI to resolve explicitly.
export async function bulkCreateClients(
    items: { name: string; phone?: string; email?: string }[]
): Promise<{ created: number; skipped: number; review: BulkCreateReviewItem[] }> {
    const psychologistId = await getPsychologistId();
    if (!Array.isArray(items) || items.length === 0) {
        return { created: 0, skipped: 0, review: [] };
    }
    await requirePracticeOperatorAttestation(psychologistId);

    const knownClients: ClientIdentity[] = await db.diaryClient.findMany({
        where: { psychologistId },
        select: { id: true, name: true, phone: true, email: true },
    });

    let created = 0;
    let skipped = 0;
    const review: BulkCreateReviewItem[] = [];
    const seenInBatch = new Set<string>();

    for (const raw of items) {
        const name = (raw.name || '').trim();
        if (!name || name.length < 2) {
            skipped++;
            continue;
        }
        const key = name.toLowerCase();
        if (seenInBatch.has(key)) {
            skipped++;
            continue;
        }
        seenInBatch.add(key);

        const match = matchClientIdentity({ name, phone: raw.phone, email: raw.email }, knownClients);
        if (match.resolvedClientId) {
            // Strong (phone/email) identity match — a real duplicate.
            skipped++;
            continue;
        }
        if (match.matchReason === 'name_only' || match.matchReason === 'conflict') {
            review.push({
                name,
                status: 'review',
                reason: 'NAME_ONLY_COLLISION',
                suggestedClientIds: match.suggestedClientId ? [match.suggestedClientId] : [],
            });
            continue;
        }

        const client = await db.diaryClient.create({
            data: {
                psychologistId,
                name,
                phone: raw.phone || null,
                email: raw.email || null,
            },
        });
        knownClients.push({ id: client.id, name, phone: raw.phone || null, email: raw.email || null });
        created++;
    }

    revalidatePath('/diary');
    revalidatePath('/diary/clients');
    return { created, skipped, review };
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
