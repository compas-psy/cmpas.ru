// Task 12 (PRAKTIKA MVP, founder correction round 3): the atomic, idempotent,
// ownership-checked, rollback-capable commit core for calendar/spreadsheet
// import. Domain-level — commitPracticeImport/rollbackPracticeImport enforce
// ownership and operator attestation themselves, so no future caller
// (Task 13, a script, a test) can reach the DB mutations without going
// through the legal gate.
//
// State machine (PracticeImportBatch.status): preview -> committing ->
// committed | failed -> rolled_back. 'failed' is retryable (a genuine DB
// error rolled back the whole transaction, so every item is still
// 'pending' — reprocessing from scratch is safe and idempotent via the
// same identity checks). 'committed' and 'rolled_back' are terminal.
import { db } from '@/lib/db';
import { requirePracticeOperatorAttestation } from '@/lib/practice/attestation';
import { calendarDateToUtcMidnight, utcDatePart, utcDayBounds, utcTimePart } from './date-utils';

export type ImportItemStatus = 'pending' | 'imported' | 'skipped' | 'error' | 'rolled_back';
export type BatchStatus = 'preview' | 'committing' | 'committed' | 'failed' | 'rolled_back';

export interface ImportItemResolution {
    decision: 'session' | 'personal' | 'skip';
    clientMode: 'existing' | 'new' | null;
    resolvedClientId: string | null;
    newClientName: string | null;
    format: 'online' | 'offline';
    addressId: string | null;
    duration: number;
}

export interface CommitOutcomeRow {
    itemId: string;
    status: ImportItemStatus;
    errorCode?: string;
    createdClientId?: string | null;
    createdSessionId?: string | null;
    calendarSessionLinkId?: string | null;
}

export interface CommitResult {
    batchId: string;
    status: BatchStatus;
    imported: number;
    skipped: number;
    failed: number;
    outcomes: CommitOutcomeRow[];
}

export class CommitConflictError extends Error {
    code: 'COMMIT_IN_PROGRESS';
    constructor() {
        super('COMMIT_IN_PROGRESS');
        this.name = 'CommitConflictError';
        this.code = 'COMMIT_IN_PROGRESS';
    }
}

export class RollbackConflictError extends Error {
    code: string;
    constructor(code: string) {
        super(code);
        this.name = 'RollbackConflictError';
        this.code = code;
    }
}

const ORIGIN_BY_SOURCE_TYPE: Record<string, string> = {
    calendar: 'calendar_import',
    spreadsheet: 'spreadsheet_import',
};

type Tx = Parameters<Parameters<typeof db.$transaction>[0]>[0];

/** Per-psychologist advisory lock, held for the transaction's lifetime. Seed 2: booking.ts uses seed 0 (day lock) and seed 1 (session lock) in the same hashtextextended keyspace family — never colliding since seeds differ. */
async function acquireImportLock(tx: Tx, psychologistId: string) {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${psychologistId}, 2))`;
}

async function resolveOrCreateClient(
    tx: Tx,
    psychologistId: string,
    resolution: ImportItemResolution,
): Promise<{ ok: true; clientId: string; createdClientId: string | null } | { ok: false; errorCode: string }> {
    const hasResolvedClient = !!resolution.resolvedClientId;
    const hasNewClientName = !!resolution.newClientName && resolution.newClientName.trim().length >= 2;
    if ((!hasResolvedClient && !hasNewClientName) || (hasResolvedClient && hasNewClientName)) {
        return { ok: false, errorCode: 'AMBIGUOUS_CLIENT_RESOLUTION' };
    }
    if (hasResolvedClient) {
        const client = await tx.diaryClient.findFirst({ where: { id: resolution.resolvedClientId!, psychologistId }, select: { id: true } });
        if (!client) return { ok: false, errorCode: 'CLIENT_NOT_OWNED' };
        return { ok: true, clientId: client.id, createdClientId: null };
    }
    // Point 9: this is the LAST step of validation for client_only items —
    // for session items, every other check (integration, address, conflict)
    // has already passed by the time this runs (see commitOneItem), so this
    // create is never followed by a "soft" failure that would orphan it.
    const created = await tx.diaryClient.create({ data: { psychologistId, name: resolution.newClientName!.trim(), status: 'active' } });
    return { ok: true, clientId: created.id, createdClientId: created.id };
}

interface ItemRow {
    id: string;
    integrationId: string | null;
    provider: string | null;
    externalEventId: string | null;
    externalSeriesId: string | null;
    sourceSummary: string | null;
    classification: string;
    resolution: unknown;
    startAt: Date | null;
    endAt: Date | null;
}

interface RunningSlot {
    dateKey: string;
    startMin: number;
    endMin: number;
}

async function commitOneItem(
    tx: Tx,
    psychologistId: string,
    sourceType: string,
    item: ItemRow,
    runningSlots: RunningSlot[],
): Promise<CommitOutcomeRow> {
    const resolution = item.resolution as ImportItemResolution | null;

    // client_only: create/match a DiaryClient only — never fabricate a
    // session or a date/time for a row that never had one (Task 12
    // correction, item 6).
    if (item.classification === 'client_only') {
        if (!resolution) return { itemId: item.id, status: 'error', errorCode: 'MISSING_RESOLUTION' };
        const clientResult = await resolveOrCreateClient(tx, psychologistId, resolution);
        if (!clientResult.ok) return { itemId: item.id, status: 'error', errorCode: clientResult.errorCode };
        return { itemId: item.id, status: 'imported', createdClientId: clientResult.createdClientId };
    }

    if (!item.startAt || Number.isNaN(item.startAt.getTime())) {
        return { itemId: item.id, status: 'error', errorCode: 'INVALID_DATE_OR_TIME' };
    }
    if (!resolution) return { itemId: item.id, status: 'error', errorCode: 'MISSING_RESOLUTION' };
    if (!Number.isFinite(resolution.duration) || resolution.duration <= 0) {
        return { itemId: item.id, status: 'error', errorCode: 'INVALID_DURATION' };
    }

    // 1. Idempotency — the real identity check, before anything else. A
    // linked event is always 'skipped', regardless of what else is true.
    if (item.integrationId && item.externalEventId) {
        const existingLink = await tx.calendarSessionLink.findUnique({
            where: { integrationId_externalEventId: { integrationId: item.integrationId, externalEventId: item.externalEventId } },
        });
        if (existingLink) {
            return { itemId: item.id, status: 'skipped', errorCode: 'ALREADY_IMPORTED', createdSessionId: existingLink.sessionId };
        }
    }

    // 2. Integration ownership — never trust the FK alone; it proves the
    // integration exists, not that it belongs to THIS psychologist.
    if (item.integrationId) {
        const integration = await tx.calendarIntegration.findFirst({
            where: { id: item.integrationId, psychologistId, ...(item.provider ? { provider: item.provider } : {}) },
            select: { id: true },
        });
        if (!integration) return { itemId: item.id, status: 'error', errorCode: 'INTEGRATION_NOT_OWNED' };
    }

    // 3. Client resolution — validated, NOT created yet (point 9: no
    // mutation until every check that could still fail has passed).
    const hasResolvedClient = !!resolution.resolvedClientId;
    const hasNewClientName = !!resolution.newClientName && resolution.newClientName.trim().length >= 2;
    if ((!hasResolvedClient && !hasNewClientName) || (hasResolvedClient && hasNewClientName)) {
        return { itemId: item.id, status: 'error', errorCode: 'AMBIGUOUS_CLIENT_RESOLUTION' };
    }
    if (hasResolvedClient) {
        const client = await tx.diaryClient.findFirst({ where: { id: resolution.resolvedClientId!, psychologistId }, select: { id: true } });
        if (!client) return { itemId: item.id, status: 'error', errorCode: 'CLIENT_NOT_OWNED' };
    }

    // 4. Address — validated, not mutating anything.
    let addressId: string | null = null;
    if (resolution.format === 'offline') {
        if (!resolution.addressId) return { itemId: item.id, status: 'error', errorCode: 'ADDRESS_REQUIRED' };
        const address = await tx.psychologistAddress.findFirst({ where: { id: resolution.addressId, psychologistId }, select: { id: true } });
        if (!address) return { itemId: item.id, status: 'error', errorCode: 'ADDRESS_NOT_OWNED' };
        addressId = resolution.addressId;
    }

    // 5. Conflict — real interval overlap against the psychologist's
    // existing schedule AND every session already created earlier in this
    // same batch, not just an exact (client, date, time) match (Task 12
    // correction, item 8). ALREADY_IMPORTED (step 1) is a separate signal
    // and always takes priority over this.
    const dateKey = utcDatePart(item.startAt);
    const startMin = item.startAt.getUTCHours() * 60 + item.startAt.getUTCMinutes();
    const endMin = startMin + resolution.duration;
    const { start: dayStart, end: dayEnd } = utcDayBounds(item.startAt);

    const existingSessions = await tx.diarySession.findMany({
        where: { psychologistId, date: { gte: dayStart, lte: dayEnd }, status: { not: 'cancelled' } },
        select: { time: true, duration: true },
    });
    const overlaps = (aStart: number, aEnd: number, bStart: number, bEnd: number) => aStart < bEnd && bStart < aEnd;
    const overlapsExisting = existingSessions.some((s) => {
        const [h, m] = s.time.split(':').map(Number);
        return overlaps(startMin, endMin, h * 60 + m, h * 60 + m + s.duration);
    });
    const overlapsThisRun = runningSlots.some((s) => s.dateKey === dateKey && overlaps(startMin, endMin, s.startMin, s.endMin));
    if (overlapsExisting || overlapsThisRun) {
        return { itemId: item.id, status: 'error', errorCode: 'SESSION_CONFLICT' };
    }

    // 6. Every check that could fail has passed — mutate.
    const clientResult = await resolveOrCreateClient(tx, psychologistId, resolution);
    if (!clientResult.ok) return { itemId: item.id, status: 'error', errorCode: clientResult.errorCode };

    const origin = ORIGIN_BY_SOURCE_TYPE[sourceType] ?? 'calendar_import';
    const session = await tx.diarySession.create({
        data: {
            psychologistId,
            clientId: clientResult.clientId,
            date: calendarDateToUtcMidnight(dateKey),
            time: utcTimePart(item.startAt),
            endTime: item.endAt ? utcTimePart(item.endAt) : null,
            duration: resolution.duration,
            type: 'individual',
            format: resolution.format,
            addressId,
            status: 'confirmed',
            // Task 12 correction, item 7: the external calendar title is
            // preview-only context — never copied into DiarySession.notes.
            notes: null,
            // Task 9's provenance/communication-policy split.
            origin,
            clientNotificationsEnabled: false,
        },
    });

    let calendarSessionLinkId: string | null = null;
    if (item.integrationId && item.externalEventId) {
        // No try/catch around this: if this throws (point 13 — PostgreSQL
        // aborts an interactive transaction on a constraint violation, no
        // safe way to keep writing after catching it), let it propagate and
        // fail the whole batch closed. seenEventKeys in the caller already
        // prevents the one case that could legitimately trigger this (the
        // same external event submitted twice in one batch).
        const link = await tx.calendarSessionLink.create({
            data: {
                psychologistId,
                integrationId: item.integrationId,
                sessionId: session.id,
                externalEventId: item.externalEventId,
                externalSeriesId: item.externalSeriesId,
                sourceRole: 'imported',
            },
        });
        calendarSessionLinkId = link.id;
    }

    runningSlots.push({ dateKey, startMin, endMin });
    return { itemId: item.id, status: 'imported', createdClientId: clientResult.createdClientId, createdSessionId: session.id, calendarSessionLinkId };
}

async function loadPersistedResult(batch: { id: string; status: string; imported: number; skipped: number; failed: number }): Promise<CommitResult> {
    const items = await db.practiceImportItem.findMany({ where: { batchId: batch.id } });
    return {
        batchId: batch.id,
        status: batch.status as BatchStatus,
        imported: batch.imported,
        skipped: batch.skipped,
        failed: batch.failed,
        outcomes: items.map((i) => ({
            itemId: i.id,
            status: i.status as ImportItemStatus,
            errorCode: i.errorCode ?? undefined,
            createdClientId: i.createdClientId ?? undefined,
            createdSessionId: i.createdSessionId ?? undefined,
            calendarSessionLinkId: i.calendarSessionLinkId ?? undefined,
        })),
    };
}

type ClaimResult =
    | { kind: 'claimed' }
    | { kind: 'in_progress' }
    | { kind: 'already_done'; result: CommitResult };

/**
 * Atomically claims the batch for processing (preview|failed -> committing)
 * with a single guarded UPDATE, OUTSIDE any long-lived transaction — so the
 * claim is visible immediately to any concurrent request racing for the
 * same batch. 'failed' is re-claimable: a genuine DB error rolls back the
 * WHOLE transaction (see commitPracticeImport's catch boundary), so a
 * failed batch's items are always still 'pending' — reprocessing them from
 * scratch is safe and idempotent via the same identity checks.
 */
async function claimBatchForCommit(psychologistId: string, batchId: string): Promise<ClaimResult> {
    const affected: number = await db.$executeRaw`
        UPDATE "PracticeImportBatch"
        SET status = 'committing', "updatedAt" = now()
        WHERE id = ${batchId} AND "psychologistId" = ${psychologistId} AND status IN ('preview', 'failed')
    `;
    if (affected > 0) return { kind: 'claimed' };

    const existing = await db.practiceImportBatch.findFirst({ where: { id: batchId, psychologistId } });
    if (!existing) throw new Error('BATCH_NOT_FOUND');
    if (existing.status === 'committing') return { kind: 'in_progress' };
    // 'committed' or 'rolled_back' — terminal. Never reprocess; return the
    // persisted, authoritative result exactly as it was written the first
    // time (never re-derived as ALREADY_IMPORTED or anything else).
    return { kind: 'already_done', result: await loadPersistedResult(existing) };
}

async function runCommitTransaction(psychologistId: string, batchId: string): Promise<CommitResult> {
    return db.$transaction(async (tx) => {
        await acquireImportLock(tx, psychologistId);

        // Re-read fresh, INSIDE the lock — the authoritative state, per the
        // founder's explicit instruction, even though we already claimed
        // the batch moments ago outside this transaction.
        const batch = await tx.practiceImportBatch.findFirst({
            where: { id: batchId, psychologistId },
            include: { items: true },
        });
        if (!batch) throw new Error('BATCH_NOT_FOUND');

        const runningSlots: RunningSlot[] = [];
        const seenEventKeys = new Set<string>();
        const outcomes: CommitOutcomeRow[] = [];

        for (const item of batch.items) {
            const eventKey = item.integrationId && item.externalEventId ? `${item.integrationId}::${item.externalEventId}` : null;

            let outcome: CommitOutcomeRow;
            if (eventKey && seenEventKeys.has(eventKey)) {
                // Same external event submitted twice within this one
                // batch — never let it reach the DB as a genuine unique
                // conflict (point 13: no catching P2002 mid-transaction).
                outcome = { itemId: item.id, status: 'skipped', errorCode: 'ALREADY_IMPORTED' };
            } else {
                outcome = await commitOneItem(tx, psychologistId, batch.sourceType, item, runningSlots);
                if (eventKey) seenEventKeys.add(eventKey);
            }
            outcomes.push(outcome);

            await tx.practiceImportItem.update({
                where: { id: item.id },
                data: {
                    status: outcome.status,
                    errorCode: outcome.errorCode ?? null,
                    createdClientId: outcome.createdClientId ?? null,
                    createdSessionId: outcome.createdSessionId ?? null,
                    calendarSessionLinkId: outcome.calendarSessionLinkId ?? null,
                    // Point 7: clear the external title once resolved either
                    // way; an error item keeps it — still needs review.
                    sourceSummary: outcome.status === 'imported' || outcome.status === 'skipped' ? null : item.sourceSummary,
                },
            });
        }

        const imported = outcomes.filter((o) => o.status === 'imported').length;
        const skipped = outcomes.filter((o) => o.status === 'skipped').length;
        const failed = outcomes.filter((o) => o.status === 'error').length;

        await tx.practiceImportBatch.update({
            where: { id: batchId },
            data: { status: 'committed', committedAt: new Date(), imported, skipped, failed },
        });

        return { batchId, status: 'committed' as const, imported, skipped, failed, outcomes };
    }, { timeout: 30000 });
}

/**
 * Domain-level entry point — enforces ownership (owner-scoped batch lookup)
 * and operator attestation ITSELF, so no future caller (Task 13, a script,
 * a test) can reach the mutations below without going through the legal
 * gate. psychologistId comes first: this is who is COMMITTING, the
 * authorization boundary, not an incidental parameter.
 */
export async function commitPracticeImport(psychologistId: string, batchId: string): Promise<CommitResult> {
    await requirePracticeOperatorAttestation(psychologistId);

    const claim = await claimBatchForCommit(psychologistId, batchId);
    if (claim.kind === 'in_progress') throw new CommitConflictError();
    if (claim.kind === 'already_done') return claim.result;

    let result: CommitResult;
    try {
        result = await runCommitTransaction(psychologistId, batchId);
    } catch (error) {
        // Point 12: the transaction (including every outcome write and the
        // batch status update attempted inside it) has already rolled back
        // in Postgres by the time we get here — the batch is NOT sitting at
        // 'committing' forever, it just isn't 'failed' yet either. This is a
        // separate, short write outside the dead transaction so the batch
        // never gets stuck: it becomes retryable (see claimBatchForCommit).
        await db.practiceImportBatch.updateMany({
            where: { id: batchId, psychologistId },
            data: { status: 'failed' },
        });
        throw error;
    }

    // Task 12 item 11: an imported session syncs OUT to the psychologist's
    // OTHER connected calendars (never back into the one it came FROM —
    // that would reflect a second, duplicate event into the source
    // calendar). Deliberately OUTSIDE the transaction above — this is real
    // network I/O, and best-effort like every other auto-sync call site:
    // a sync failure here must never undo an already-committed import.
    await syncImportedSessionsToOtherCalendars(psychologistId, result);

    return result;
}

async function syncImportedSessionsToOtherCalendars(psychologistId: string, result: CommitResult) {
    const imported = result.outcomes.filter((o) => o.status === 'imported' && o.createdSessionId);
    if (!imported.length) return;

    const items = await db.practiceImportItem.findMany({ where: { id: { in: imported.map((o) => o.itemId) } } });
    const itemById = new Map(items.map((i) => [i.id, i]));

    const { autoSyncSessionToCalendars } = await import('@/lib/calendar/auto-sync');
    for (const outcome of imported) {
        const item = itemById.get(outcome.itemId);
        try {
            const session = await db.diarySession.findUnique({
                where: { id: outcome.createdSessionId! },
                include: { client: { select: { name: true } } },
            });
            if (!session) continue;
            await autoSyncSessionToCalendars(psychologistId, session, { excludeIntegrationId: item?.integrationId ?? undefined });
        } catch (e) {
            console.error('[commitPracticeImport] post-commit sync-out failed', outcome.itemId, e);
        }
    }
}

/**
 * Owner-scoped rollback of a committed batch. Deletes/detaches ONLY objects
 * this batch proved it created (createdSessionId/calendarSessionLinkId/
 * createdClientId on each item) — never a matched pre-existing client, and
 * never a session that looks like it's been touched since import (status
 * changed off 'confirmed', notes added, reminders already sent) — those
 * come back as a per-item rollback conflict instead of being silently
 * force-deleted.
 */
export async function rollbackPracticeImport(psychologistId: string, batchId: string): Promise<{ batchId: string; outcomes: { itemId: string; status: 'rolled_back' | 'skipped' | 'conflict'; reason?: string }[] }> {
    await requirePracticeOperatorAttestation(psychologistId);

    const batch = await db.practiceImportBatch.findFirst({ where: { id: batchId, psychologistId }, include: { items: true } });
    if (!batch) throw new Error('BATCH_NOT_FOUND');
    if (batch.status !== 'committed') throw new RollbackConflictError('BATCH_NOT_COMMITTED');

    return db.$transaction(async (tx) => {
        await acquireImportLock(tx, psychologistId);

        const fresh = await tx.practiceImportBatch.findFirst({ where: { id: batchId, psychologistId }, include: { items: true } });
        if (!fresh || fresh.status !== 'committed') throw new RollbackConflictError('BATCH_NOT_COMMITTED');

        const outcomes: { itemId: string; status: 'rolled_back' | 'skipped' | 'conflict'; reason?: string }[] = [];

        for (const item of fresh.items) {
            if (item.status !== 'imported') {
                outcomes.push({ itemId: item.id, status: 'skipped' });
                continue;
            }

            if (item.createdSessionId) {
                const session = await tx.diarySession.findUnique({ where: { id: item.createdSessionId } });
                if (session) {
                    const touched = session.status !== 'confirmed'
                        || !!session.notes || !!session.structuredNotes || !!session.privateNotes
                        || session.notified24h || session.notified1h || session.postSessionNudged;
                    if (touched) {
                        outcomes.push({ itemId: item.id, status: 'conflict', reason: 'SESSION_MODIFIED_SINCE_IMPORT' });
                        continue;
                    }
                }
            }

            const resolution = item.resolution as ImportItemResolution | null;
            if (item.createdClientId && resolution?.clientMode === 'new') {
                const otherSessions = await tx.diarySession.count({
                    where: { clientId: item.createdClientId, id: { not: item.createdSessionId ?? undefined } },
                });
                if (otherSessions > 0) {
                    outcomes.push({ itemId: item.id, status: 'conflict', reason: 'CLIENT_HAS_OTHER_SESSIONS' });
                    continue;
                }
            }

            if (item.calendarSessionLinkId) {
                await tx.calendarSessionLink.deleteMany({ where: { id: item.calendarSessionLinkId } });
            }
            if (item.createdSessionId) {
                await tx.diarySession.deleteMany({ where: { id: item.createdSessionId } });
            }
            // Never delete a matched pre-existing client — only one THIS item created.
            if (item.createdClientId && resolution?.clientMode === 'new') {
                await tx.diaryClient.deleteMany({ where: { id: item.createdClientId } });
            }

            await tx.practiceImportItem.update({ where: { id: item.id }, data: { status: 'rolled_back' } });
            outcomes.push({ itemId: item.id, status: 'rolled_back' });
        }

        const anyConflict = outcomes.some((o) => o.status === 'conflict');
        await tx.practiceImportBatch.update({
            where: { id: batchId },
            data: anyConflict
                ? {} // leave status='committed' if anything refused to roll back — never claim a full rollback that wasn't
                : { status: 'rolled_back', rolledBackAt: new Date() },
        });

        return { batchId, outcomes };
    }, { timeout: 30000 });
}
