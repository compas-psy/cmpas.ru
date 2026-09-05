import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { createNotification } from '@/lib/notifications';
import { ATTESTATION_REQUIRED_CODE } from '@/lib/practice/attestation';
import { commitPracticeImport, CommitConflictError } from '@/lib/practice/migration/commit';
import { calendarDateTimeToUtc } from '@/lib/practice/migration/date-utils';
import { trackMigrationCommitted, trackMigrationFailed, type MigrationProvider } from '@/lib/analytics/practice-events';

// Task 12 (PRAKTIKA MVP, founder correction round 3): this route is a thin
// front for the real commit path. It does two things: (1) persist exactly
// what the psychologist submitted as a durable PracticeImportBatch/
// PracticeImportItem — the "evidence" a commit can be inspected against
// later, even if it partially fails — and (2) call
// commitPracticeImport(psychologistId, batchId), the transactional,
// advisory-locked, ownership-checked, CalendarSessionLink-idempotent commit
// (src/lib/practice/migration/commit.ts). ALL validation (date/time shape,
// duration, exactly one client resolution, integration/address ownership,
// schedule conflicts) lives in commitOneItem — including operator
// attestation, enforced by commitPracticeImport itself, not duplicated
// here — so this route never needs to re-check the legal gate; it only
// coerces raw JSON into the batch item shape.
//
// startAt/endAt are computed here via calendarDateTimeToUtc — never a bare
// `new Date(dateStr)` — from the date/startTime/endTime strings the preview
// route already resolved against the practice's configured timezone
// (Task 10). That is the ONE piece of real interpretation this route does;
// everything else is a straight, typed copy of the submitted body.

const VALID_FORMATS = new Set(['online', 'offline']);
const VALID_DECISIONS = new Set(['session', 'personal', 'skip']);
const VALID_CLIENT_MODES = new Set(['existing', 'new']);

// Задача 25 §3: provider в аналитике — только известное значение реестра и
// только когда партия целиком из одного календаря. Смешанную партию честнее
// оставить без provider, чем назвать её именем первого элемента.
function analyticsProvider(items: { provider: string | null }[]): MigrationProvider | undefined {
    const providers = new Set(items.map((item) => item.provider));
    if (providers.size !== 1) return undefined;
    const only = items[0]?.provider;
    return only === 'google' || only === 'yandex' ? only : undefined;
}

function coerceItem(raw: Record<string, unknown>) {
    const format = typeof raw.format === 'string' && VALID_FORMATS.has(raw.format) ? raw.format : 'online';
    const decision = typeof raw.decision === 'string' && VALID_DECISIONS.has(raw.decision) ? raw.decision : 'session';
    const clientMode = typeof raw.clientMode === 'string' && VALID_CLIENT_MODES.has(raw.clientMode) ? raw.clientMode : null;
    const date = typeof raw.date === 'string' ? raw.date : '';
    const startTime = typeof raw.startTime === 'string' ? raw.startTime : '';
    const endTime = typeof raw.endTime === 'string' ? raw.endTime : null;
    const classification = typeof raw.classification === 'string' ? raw.classification : 'uncertain';
    const isDated = /^\d{4}-\d{2}-\d{2}$/.test(date) && /^\d{2}:\d{2}$/.test(startTime);

    return {
        integrationId: typeof raw.integrationId === 'string' && raw.integrationId ? raw.integrationId : null,
        provider: typeof raw.provider === 'string' && raw.provider ? raw.provider : null,
        externalEventId: typeof raw.externalEventId === 'string' && raw.externalEventId ? raw.externalEventId : null,
        externalSeriesId: typeof raw.externalSeriesId === 'string' ? raw.externalSeriesId : null,
        sourceSummary: typeof raw.summary === 'string' ? raw.summary.trim().slice(0, 500) : null,
        classification,
        startAt: isDated && classification !== 'client_only' ? calendarDateTimeToUtc(date, startTime) : null,
        endAt: isDated && endTime && /^\d{2}:\d{2}$/.test(endTime) && classification !== 'client_only' ? calendarDateTimeToUtc(date, endTime) : null,
        resolution: {
            decision,
            clientMode,
            resolvedClientId: clientMode === 'existing' && typeof raw.resolvedClientId === 'string' && raw.resolvedClientId ? raw.resolvedClientId : null,
            newClientName: clientMode === 'new' && typeof raw.newClientName === 'string' ? raw.newClientName.trim().slice(0, 120) : null,
            format,
            addressId: format === 'offline' && typeof raw.addressId === 'string' ? raw.addressId : null,
            duration: Number(raw.duration),
        },
    };
}

export async function POST(req: NextRequest) {
    const session = await auth();
    const psychologistId = session?.user?.id;
    if (!psychologistId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const body = await req.json();
        const rawItems: Record<string, unknown>[] = Array.isArray(body.items) ? body.items.slice(0, 100) : [];
        if (!rawItems.length) return NextResponse.json({ imported: 0, skipped: 0, failed: 0 });

        const items = rawItems.map(coerceItem);

        // rangeStart/rangeEnd/summary are audit context, derived straight
        // from what was actually submitted — not re-fetched from
        // practiceImportRange, which would need another timezone lookup for
        // a value this batch's own items already carry.
        const datedStarts = items.map((i) => i.startAt).filter((d): d is Date => d !== null);
        const rangeStart = datedStarts.length ? new Date(Math.min(...datedStarts.map((d) => d.getTime()))) : null;
        const rangeEnd = datedStarts.length ? new Date(Math.max(...datedStarts.map((d) => d.getTime()))) : null;
        const summary = items.reduce((acc: Record<string, number>, i) => {
            acc[i.classification] = (acc[i.classification] || 0) + 1;
            return acc;
        }, {});

        const batch = await db.practiceImportBatch.create({
            data: {
                psychologistId,
                sourceType: 'calendar',
                rangeStart,
                rangeEnd,
                summary,
                items: { create: items },
            },
        });

        const result = await commitPracticeImport(psychologistId, batch.id);

        // Только после состоявшегося commit и только его собственными
        // числами: ни одной строки календаря, ни одного названия встречи.
        await trackMigrationCommitted({ accountId: psychologistId }, {
            source: 'calendar',
            provider: analyticsProvider(items),
            imported_count: result.imported,
            skipped_count: result.skipped,
            failed_count: result.failed,
        });

        if (result.imported > 0) {
            await createNotification({
                psychologistId,
                type: 'calendar_imported',
                title: 'Календарь импортирован',
                subtitle: `Добавлено встреч: ${result.imported}. Пропущено: ${result.skipped}.`,
            });
        }

        return NextResponse.json({
            imported: result.imported,
            skipped: result.skipped,
            failed: result.failed,
            batchId: result.batchId,
            sessionIds: result.outcomes.filter((o) => o.status === 'imported' && o.createdSessionId).map((o) => o.createdSessionId),
        });
    } catch (error) {
        const account = { accountId: psychologistId };
        if (error instanceof Error && error.message === ATTESTATION_REQUIRED_CODE) {
            await trackMigrationFailed(account, { source: 'calendar', error_code: 'attestation_required' });
            return NextResponse.json({ error: ATTESTATION_REQUIRED_CODE }, { status: 403 });
        }
        if (error instanceof CommitConflictError) {
            await trackMigrationFailed(account, { source: 'calendar', error_code: 'commit_in_progress' });
            return NextResponse.json({ error: error.code }, { status: 409 });
        }
        await trackMigrationFailed(account, { source: 'calendar', error_code: 'internal_error' });
        console.error('[calendar/import/apply POST]', error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
