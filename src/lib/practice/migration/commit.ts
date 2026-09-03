// Task 12 (PRAKTIKA MVP): the atomic, idempotent replacement for the old
// inline per-item loop in apply/route.ts. commitPracticeImport(batchId)
// processes a durably-persisted PracticeImportBatch (created by the route
// from whatever the psychologist resolved in the preview UI) inside ONE
// transaction, under a per-psychologist advisory lock (same pattern as
// Task 7/8's booking core — src/lib/practice/booking/booking.ts), and
// writes each item's outcome back onto its row: the "evidence" a psychologist
// (or a debugging session) can look at afterward, whether the commit fully
// succeeded, partially skipped duplicates, or rolled back entirely.
//
// Idempotency: CalendarSessionLink's @@unique([integrationId,
// externalEventId]) is the real identity check — not the (date, time,
// name) heuristic preview used until now. A second commit attempt for an
// event already linked (a retried request, a re-submitted stale batch, two
// browser tabs) always resolves to 'skipped', never a duplicate session.
import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';

export type ImportItemOutcome = 'imported' | 'skipped' | 'failed';

export interface CommitOutcomeRow {
    itemId: string;
    status: ImportItemOutcome;
    reason?: string;
    sessionId?: string;
}

export interface CommitResult {
    batchId: string;
    status: 'committed';
    imported: number;
    skipped: number;
    failed: number;
    outcomes: CommitOutcomeRow[];
}

type Tx = Parameters<Parameters<typeof db.$transaction>[0]>[0];

/** Per-psychologist advisory lock, held for the transaction's lifetime — a second concurrent commit for the SAME psychologist (double-click, two tabs) serializes instead of racing past a stale duplicate/idempotency check. Seed 2: booking.ts already uses seed 0 (day lock) and seed 1 (session lock) in the same hashtextextended keyspace family — never colliding since seeds differ. */
async function acquireImportLock(tx: Tx, psychologistId: string) {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${psychologistId}, 2))`;
}

function isUniqueConstraintError(e: unknown): boolean {
    return e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002';
}

async function commitOneItem(
    tx: Tx,
    psychologistId: string,
    item: { id: string; provider: string; integrationId: string; externalEventId: string; externalSeriesId: string | null; summary: string; date: Date; startTime: string; endTime: string | null; duration: number; format: string; addressId: string | null; resolvedClientId: string | null; newClientName: string | null },
): Promise<CommitOutcomeRow> {
    if (Number.isNaN(item.date.getTime()) || !/^\d{2}:\d{2}$/.test(item.startTime)) {
        return { itemId: item.id, status: 'failed', reason: 'INVALID_DATE_OR_TIME' };
    }
    if (!Number.isFinite(item.duration) || item.duration <= 0) {
        return { itemId: item.id, status: 'failed', reason: 'INVALID_DURATION' };
    }

    const hasResolvedClient = !!item.resolvedClientId;
    const hasNewClientName = !!item.newClientName && item.newClientName.trim().length >= 2;
    if ((!hasResolvedClient && !hasNewClientName) || (hasResolvedClient && hasNewClientName)) {
        return { itemId: item.id, status: 'failed', reason: 'AMBIGUOUS_CLIENT_RESOLUTION' };
    }

    // Real idempotency check — see the module comment.
    const existingLink = await tx.calendarSessionLink.findUnique({
        where: { integrationId_externalEventId: { integrationId: item.integrationId, externalEventId: item.externalEventId } },
    });
    if (existingLink) {
        return { itemId: item.id, status: 'skipped', reason: 'ALREADY_IMPORTED', sessionId: existingLink.sessionId };
    }

    let clientId: string;
    if (hasResolvedClient) {
        const client = await tx.diaryClient.findFirst({ where: { id: item.resolvedClientId!, psychologistId }, select: { id: true } });
        if (!client) return { itemId: item.id, status: 'failed', reason: 'CLIENT_NOT_OWNED' };
        clientId = client.id;
    } else {
        const created = await tx.diaryClient.create({
            data: { psychologistId, name: item.newClientName!.trim(), status: 'active' },
        });
        clientId = created.id;
    }

    // addressId is never trusted as pre-validated — re-checked here even
    // though the route validates it too, since this function is the actual
    // transactional boundary and must be correct standing alone.
    let addressId: string | null = null;
    if (item.format === 'offline') {
        if (!item.addressId) return { itemId: item.id, status: 'failed', reason: 'ADDRESS_REQUIRED' };
        const address = await tx.psychologistAddress.findFirst({ where: { id: item.addressId, psychologistId }, select: { id: true } });
        if (!address) return { itemId: item.id, status: 'failed', reason: 'ADDRESS_NOT_OWNED' };
        addressId = item.addressId;
    }

    const dateStr = item.date.toISOString().slice(0, 10);
    const dayStart = new Date(dateStr); dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dateStr); dayEnd.setHours(23, 59, 59, 999);
    const duplicateSession = await tx.diarySession.findFirst({
        where: { psychologistId, clientId, date: { gte: dayStart, lte: dayEnd }, time: item.startTime, status: { not: 'cancelled' } },
    });
    if (duplicateSession) {
        return { itemId: item.id, status: 'skipped', reason: 'SESSION_ALREADY_EXISTS' };
    }

    try {
        const session = await tx.diarySession.create({
            data: {
                psychologistId,
                clientId,
                date: dayStart,
                time: item.startTime,
                endTime: item.endTime && /^\d{2}:\d{2}$/.test(item.endTime) ? item.endTime : null,
                duration: item.duration,
                type: 'individual',
                format: item.format,
                addressId,
                status: 'pending',
                notes: item.summary?.trim() || null,
                // Task 9's provenance/communication-policy split.
                origin: 'calendar_import',
                clientNotificationsEnabled: false,
            },
        });
        await tx.calendarSessionLink.create({
            data: {
                psychologistId,
                sessionId: session.id,
                integrationId: item.integrationId,
                provider: item.provider,
                externalEventId: item.externalEventId,
                externalSeriesId: item.externalSeriesId,
            },
        });
        return { itemId: item.id, status: 'imported', sessionId: session.id };
    } catch (e) {
        // A concurrent writer (another item in this same batch pointing at
        // the same external event, most likely) won the race on the unique
        // constraint between our check above and this insert — treat it the
        // same as finding the link up front, not as a failure.
        if (isUniqueConstraintError(e)) {
            return { itemId: item.id, status: 'skipped', reason: 'ALREADY_IMPORTED' };
        }
        throw e;
    }
}

export async function commitPracticeImport(batchId: string, psychologistId: string): Promise<CommitResult> {
    const batch = await db.practiceImportBatch.findFirst({
        where: { id: batchId, psychologistId },
        include: { items: true },
    });
    if (!batch) throw new Error('BATCH_NOT_FOUND');

    if (batch.status !== 'pending') {
        // Already processed (a retried request for the same batch) — return
        // the persisted outcome instead of re-running anything.
        const items = await db.practiceImportBatchItem.findMany({ where: { batchId } });
        return {
            batchId,
            status: 'committed',
            imported: batch.imported,
            skipped: batch.skipped,
            failed: batch.failed,
            outcomes: items.map((i) => ({
                itemId: i.id,
                status: i.outcomeStatus as ImportItemOutcome,
                reason: i.outcomeReason ?? undefined,
                sessionId: i.sessionId ?? undefined,
            })),
        };
    }

    const outcomes: CommitOutcomeRow[] = [];

    await db.$transaction(async (tx) => {
        await acquireImportLock(tx, psychologistId);

        for (const item of batch.items) {
            const outcome = await commitOneItem(tx, psychologistId, item);
            outcomes.push(outcome);
            await tx.practiceImportBatchItem.update({
                where: { id: item.id },
                data: { outcomeStatus: outcome.status, outcomeReason: outcome.reason ?? null, sessionId: outcome.sessionId ?? null },
            });
        }

        const imported = outcomes.filter((o) => o.status === 'imported').length;
        const skipped = outcomes.filter((o) => o.status === 'skipped').length;
        const failed = outcomes.filter((o) => o.status === 'failed').length;

        await tx.practiceImportBatch.update({
            where: { id: batchId },
            data: { status: 'committed', committedAt: new Date(), imported, skipped, failed },
        });
    }, { timeout: 30000 }); // a batch can carry many items — default 5s is too tight (see cap at 100 items in the route).

    return {
        batchId,
        status: 'committed',
        imported: outcomes.filter((o) => o.status === 'imported').length,
        skipped: outcomes.filter((o) => o.status === 'skipped').length,
        failed: outcomes.filter((o) => o.status === 'failed').length,
        outcomes,
    };
}
