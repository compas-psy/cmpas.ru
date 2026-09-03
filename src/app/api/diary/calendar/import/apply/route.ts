import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { createNotification } from '@/lib/notifications';
import { requireOwnedClient, requireOwnedAddress, OwnershipError } from '@/lib/practice/ownership';
import { requirePracticeOperatorAttestation, ATTESTATION_REQUIRED_CODE } from '@/lib/practice/attestation';

// Task 11 (founder review of Task 10) wired this to a real UI
// (import-calendar/page.tsx) and set origin/clientNotificationsEnabled
// below. Task 11 (founder correction, second round) additionally REPLACED
// the old "find-or-create DiaryClient by case-insensitive name" — that was
// exactly the silent name-only auto-match the correction banned (a name
// alone is never an identity, src/lib/clients/match.ts). The preview UI now
// resolves the client explicitly (an existing id the psychologist picked,
// or a genuinely new name to create) BEFORE this route ever runs, and sends
// that resolution — never just a name string to re-match here.
//
// This route is explicitly NOT Task 12's final commit API. Known gaps,
// still tracked as Task 12 ("Atomic/idempotent import commit") dependencies:
//   - not wrapped in a transaction/advisory lock, same class of race Task
//     7/8 fixed for booking;
//   - duplicate detection is a (date, time, clientId) heuristic, not the
//     event's stable externalEventId — CalendarSessionLink (Task 12) will
//     replace both this heuristic and this whole route with
//     commitPracticeImport(batchId).
// integrationId/externalEventId/externalSeriesId are accepted below (the
// preview UI must never discard them building this request) so Task 12 can
// start persisting them via CalendarSessionLink without having to change
// the UI's payload again — but until that model exists, this route cannot
// store them anywhere durable yet.

const VALID_FORMATS = new Set(['online', 'offline']);

export async function POST(req: NextRequest) {
    const session = await auth();
    const psychologistId = session?.user?.id;
    if (!psychologistId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const body = await req.json();
        const items = Array.isArray(body.items) ? body.items : [];
        if (!items.length) return NextResponse.json({ imported: 0, skipped: 0 });

        await requirePracticeOperatorAttestation(psychologistId);

        let imported = 0;
        let skipped = 0;
        const importedIds: string[] = [];

        for (const raw of items.slice(0, 100)) {
            const date = String(raw.date || '');
            const startTime = String(raw.startTime || '');
            const endTime = String(raw.endTime || '');
            const duration = Number(raw.duration);
            const format = VALID_FORMATS.has(raw.format) ? raw.format : 'online';
            const resolvedClientId = typeof raw.resolvedClientId === 'string' && raw.resolvedClientId ? raw.resolvedClientId : null;
            const newClientName = typeof raw.newClientName === 'string' ? raw.newClientName.trim().slice(0, 120) : '';

            if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(startTime)) {
                skipped += 1;
                continue;
            }
            if (!Number.isFinite(duration) || duration <= 0) {
                skipped += 1;
                continue;
            }
            // Exactly one explicit resolution is required — never both, and
            // never neither. A bare name with no decision is a preview-only
            // state (see classify.ts's reviewState); it must never reach
            // here as if it had been accepted.
            if ((!resolvedClientId && !newClientName) || (resolvedClientId && newClientName)) {
                skipped += 1;
                continue;
            }
            if (newClientName && newClientName.length < 2) {
                skipped += 1;
                continue;
            }

            // Founder correction: addressId is never trusted from the body.
            // Online never carries a cabinet; offline requires one the
            // psychologist actually owns — a foreign or made-up id must
            // reject the whole item, never fall back to "no cabinet".
            let addressId: string | null = null;
            if (format === 'offline') {
                const requestedAddressId = typeof raw.addressId === 'string' ? raw.addressId : '';
                if (!requestedAddressId) {
                    skipped += 1;
                    continue;
                }
                try {
                    await requireOwnedAddress(psychologistId, requestedAddressId);
                } catch (e) {
                    if (e instanceof OwnershipError) {
                        skipped += 1;
                        continue;
                    }
                    throw e;
                }
                addressId = requestedAddressId;
            }

            let clientId: string;
            if (resolvedClientId) {
                try {
                    await requireOwnedClient(psychologistId, resolvedClientId);
                } catch (e) {
                    if (e instanceof OwnershipError) {
                        skipped += 1;
                        continue;
                    }
                    throw e;
                }
                clientId = resolvedClientId;
            } else {
                // A psychologist-confirmed new client — always created, never
                // silently merged into an existing card by name (Task 11
                // correction, item 4: name-only collisions are never the
                // same person without an explicit decision).
                const created = await db.diaryClient.create({
                    data: { psychologistId, name: newClientName, status: 'active' },
                });
                clientId = created.id;
            }

            const dayStart = new Date(date); dayStart.setHours(0, 0, 0, 0);
            const dayEnd = new Date(date); dayEnd.setHours(23, 59, 59, 999);
            const duplicate = await db.diarySession.findFirst({
                where: {
                    psychologistId,
                    clientId,
                    date: { gte: dayStart, lte: dayEnd },
                    time: startTime,
                    status: { not: 'cancelled' },
                },
            });
            if (duplicate) {
                skipped += 1;
                continue;
            }

            const created = await db.diarySession.create({
                data: {
                    psychologistId,
                    clientId,
                    date: dayStart,
                    time: startTime,
                    endTime: /^\d{2}:\d{2}$/.test(endTime) ? endTime : null,
                    duration,
                    type: 'individual',
                    format,
                    addressId,
                    status: 'pending',
                    notes: String(raw.summary || '').trim() || null,
                    // Task 9's provenance/communication-policy split: a
                    // calendar-imported session never went through our
                    // booking flow, so automated client-facing messaging
                    // must stay off until the psychologist opts it back in.
                    origin: 'calendar_import',
                    clientNotificationsEnabled: false,
                },
            });
            importedIds.push(created.id);
            imported += 1;
        }

        if (imported > 0) {
            await createNotification({
                psychologistId,
                type: 'calendar_imported',
                title: 'Календарь импортирован',
                subtitle: `Добавлено встреч: ${imported}. Пропущено: ${skipped}.`,
            });
        }

        return NextResponse.json({ imported, skipped, sessionIds: importedIds });
    } catch (error) {
        if (error instanceof Error && error.message === ATTESTATION_REQUIRED_CODE) {
            return NextResponse.json({ error: ATTESTATION_REQUIRED_CODE }, { status: 403 });
        }
        console.error('[calendar/import/apply POST]', error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
