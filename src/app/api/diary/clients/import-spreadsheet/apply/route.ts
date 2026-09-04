import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { createNotification } from '@/lib/notifications';
import { ATTESTATION_REQUIRED_CODE } from '@/lib/practice/attestation';
import { commitPracticeImport, CommitConflictError } from '@/lib/practice/migration/commit';
import { calendarDateTimeToUtc } from '@/lib/practice/migration/date-utils';
import { computeClientKey, computeSourceFingerprint } from '@/lib/practice/migration/spreadsheet/fingerprint';

// Task 13: thin front for the shared Task 12 commit core, same pattern as
// /api/diary/calendar/import/apply. The psychologist's file/paste never
// touches DiaryClient/DiarySession directly — everything goes through
// PracticeImportBatch/PracticeImportItem -> commitPracticeImport. Only
// rows the psychologist explicitly resolved to "ready" are ever submitted
// (mirroring the calendar import UI's bucket philosophy).
const VALID_FORMATS = new Set(['online', 'offline']);
const VALID_MODES = new Set(['client_only', 'spreadsheet']);
const VALID_CLIENT_MODES = new Set(['existing', 'new']);

function coerceClientOnlyItem(raw: Record<string, unknown>) {
    const clientMode = typeof raw.clientMode === 'string' && VALID_CLIENT_MODES.has(raw.clientMode) ? raw.clientMode : null;
    const name = typeof raw.name === 'string' ? raw.name.trim().slice(0, 120) : '';
    const phone = typeof raw.phone === 'string' && raw.phone.trim() ? raw.phone.trim() : null;
    const email = typeof raw.email === 'string' && raw.email.trim() ? raw.email.trim() : null;

    return {
        classification: 'client_only',
        startAt: null,
        endAt: null,
        sourceFingerprint: null,
        sourceSummary: null,
        resolution: {
            decision: 'session' as const,
            clientMode,
            resolvedClientId: clientMode === 'existing' && typeof raw.resolvedClientId === 'string' && raw.resolvedClientId ? raw.resolvedClientId : null,
            newClientName: clientMode === 'new' ? name : null,
            newClientPhone: clientMode === 'new' ? phone : null,
            newClientEmail: clientMode === 'new' ? email : null,
            format: 'online' as const,
            addressId: null,
            duration: 0,
        },
    };
}

function coerceSessionItem(raw: Record<string, unknown>) {
    const clientMode = typeof raw.clientMode === 'string' && VALID_CLIENT_MODES.has(raw.clientMode) ? raw.clientMode : null;
    const name = typeof raw.name === 'string' ? raw.name.trim().slice(0, 120) : '';
    const phone = typeof raw.phone === 'string' && raw.phone.trim() ? raw.phone.trim() : null;
    const email = typeof raw.email === 'string' && raw.email.trim() ? raw.email.trim() : null;
    const format = typeof raw.format === 'string' && VALID_FORMATS.has(raw.format) ? raw.format : 'online';
    const date = typeof raw.date === 'string' ? raw.date : '';
    const startTime = typeof raw.startTime === 'string' ? raw.startTime : '';
    const endTime = typeof raw.endTime === 'string' ? raw.endTime : null;
    const duration = Number(raw.duration);
    const isDated = /^\d{4}-\d{2}-\d{2}$/.test(date) && /^\d{2}:\d{2}$/.test(startTime);
    const addressId = format === 'offline' && typeof raw.addressId === 'string' ? raw.addressId : null;

    // Task 13 §16: the backend, not the browser, is authoritative for the
    // source fingerprint — recomputed here from the resolved semantic
    // fields, never trusted verbatim from the client (a spoofed/stale
    // fingerprint would only weaken idempotency, but there is no reason to
    // accept client-computed identity when the real inputs are right here).
    const clientKey = computeClientKey({ phone, email, name });
    const sourceFingerprint = isDated && Number.isFinite(duration)
        ? computeSourceFingerprint({ clientKey, date, startTime, duration, format: format as 'online' | 'offline', addressKey: addressId ?? '' })
        : null;

    return {
        classification: 'session',
        startAt: isDated ? calendarDateTimeToUtc(date, startTime) : null,
        endAt: isDated && endTime && /^\d{2}:\d{2}$/.test(endTime) ? calendarDateTimeToUtc(date, endTime) : null,
        sourceFingerprint,
        sourceSummary: null,
        resolution: {
            decision: 'session' as const,
            clientMode,
            resolvedClientId: clientMode === 'existing' && typeof raw.resolvedClientId === 'string' && raw.resolvedClientId ? raw.resolvedClientId : null,
            newClientName: clientMode === 'new' ? name : null,
            newClientPhone: clientMode === 'new' ? phone : null,
            newClientEmail: clientMode === 'new' ? email : null,
            format,
            addressId,
            duration,
        },
    };
}

export async function POST(req: NextRequest) {
    const session = await auth();
    const psychologistId = session?.user?.id;
    if (!psychologistId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const body = await req.json();
        const mode = typeof body.mode === 'string' && VALID_MODES.has(body.mode) ? body.mode : null;
        if (!mode) return NextResponse.json({ error: 'INVALID_MODE' }, { status: 400 });

        const rawItems: Record<string, unknown>[] = Array.isArray(body.items) ? body.items.slice(0, 500) : [];
        if (!rawItems.length) return NextResponse.json({ imported: 0, skipped: 0, failed: 0 });

        const items = rawItems.map(mode === 'client_only' ? coerceClientOnlyItem : coerceSessionItem);

        const datedStarts = items.map((i) => i.startAt).filter((d): d is Date => d !== null);
        const rangeStart = datedStarts.length ? new Date(Math.min(...datedStarts.map((d) => d.getTime()))) : null;
        const rangeEnd = datedStarts.length ? new Date(Math.max(...datedStarts.map((d) => d.getTime()))) : null;
        const summary = { [mode]: items.length };

        const batch = await db.practiceImportBatch.create({
            data: {
                psychologistId,
                sourceType: mode,
                rangeStart,
                rangeEnd,
                summary,
                items: { create: items },
            },
        });

        const result = await commitPracticeImport(psychologistId, batch.id);

        if (result.imported > 0) {
            await createNotification({
                psychologistId,
                type: 'calendar_imported',
                title: mode === 'client_only' ? 'Клиенты добавлены' : 'Сессии импортированы',
                subtitle: `Добавлено: ${result.imported}. Пропущено: ${result.skipped}.`,
            });
        }

        return NextResponse.json({
            imported: result.imported,
            skipped: result.skipped,
            failed: result.failed,
            batchId: result.batchId,
            outcomes: result.outcomes,
        });
    } catch (error) {
        if (error instanceof Error && error.message === ATTESTATION_REQUIRED_CODE) {
            return NextResponse.json({ error: ATTESTATION_REQUIRED_CODE }, { status: 403 });
        }
        if (error instanceof CommitConflictError) {
            return NextResponse.json({ error: error.code }, { status: 409 });
        }
        console.error('[import-spreadsheet/apply POST]', error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
