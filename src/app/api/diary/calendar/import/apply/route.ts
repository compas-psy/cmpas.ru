import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { createNotification } from '@/lib/notifications';
import { requirePracticeOperatorAttestation, ATTESTATION_REQUIRED_CODE } from '@/lib/practice/attestation';
import { commitPracticeImport } from '@/lib/practice/migration/commit';

// Task 12 (PRAKTIKA MVP): this route is now a thin front for the real
// commit path. It does two things: (1) persist exactly what the
// psychologist submitted as a durable PracticeImportBatch/
// PracticeImportBatchItem — the "evidence" a commit can be inspected
// against later, even if it partially fails — and (2) call
// commitPracticeImport(batchId), the transactional, advisory-locked,
// CalendarSessionLink-idempotent commit (src/lib/practice/migration/
// commit.ts). All per-item validation (date/time shape, duration, exactly
// one client resolution, address ownership) now lives in commitOneItem —
// that function is the actual transactional boundary and must be correct
// standing alone, so this route does not duplicate it, only coerces raw
// JSON into the batch item shape.
//
// The response shape stays backward compatible ({ imported, skipped,
// sessionIds }) for the existing preview UI, with `batchId` added for a
// future retry/audit view.

const VALID_FORMATS = new Set(['online', 'offline']);

function coerceItem(raw: Record<string, unknown>) {
    const format = typeof raw.format === 'string' && VALID_FORMATS.has(raw.format) ? raw.format : 'online';
    return {
        provider: typeof raw.provider === 'string' ? raw.provider : 'google',
        integrationId: typeof raw.integrationId === 'string' ? raw.integrationId : '',
        externalEventId: typeof raw.externalEventId === 'string' ? raw.externalEventId : '',
        externalSeriesId: typeof raw.externalSeriesId === 'string' ? raw.externalSeriesId : null,
        summary: typeof raw.summary === 'string' ? raw.summary.trim().slice(0, 500) : '',
        date: new Date(String(raw.date || '')),
        startTime: String(raw.startTime || ''),
        endTime: typeof raw.endTime === 'string' ? raw.endTime : null,
        duration: Number(raw.duration),
        format,
        addressId: format === 'offline' && typeof raw.addressId === 'string' ? raw.addressId : null,
        resolvedClientId: typeof raw.resolvedClientId === 'string' && raw.resolvedClientId ? raw.resolvedClientId : null,
        newClientName: typeof raw.newClientName === 'string' ? raw.newClientName.trim().slice(0, 120) : null,
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

        await requirePracticeOperatorAttestation(psychologistId);

        const items = rawItems.map(coerceItem);

        const batch = await db.practiceImportBatch.create({
            data: {
                psychologistId,
                items: { create: items },
            },
        });

        const result = await commitPracticeImport(batch.id, psychologistId);

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
            sessionIds: result.outcomes.filter((o) => o.status === 'imported').map((o) => o.sessionId),
        });
    } catch (error) {
        if (error instanceof Error && error.message === ATTESTATION_REQUIRED_CODE) {
            return NextResponse.json({ error: ATTESTATION_REQUIRED_CODE }, { status: 403 });
        }
        console.error('[calendar/import/apply POST]', error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
