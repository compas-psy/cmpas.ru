// Core POST /ingest processing (charter/12_ANALYTICS.md §3), kept separate
// from the route handler so it's testable against a mocked Prisma client.
//
// Simplification worth flagging: charter/12_ANALYTICS.md §2 describes
// account_id as a cross-product pseudonym distinct from any provider ID.
// cmpas.ru doesn't have that separate identity table yet, so this treats
// account_id as this product's User.id — the same value already used
// everywhere else in this codebase as the account identifier. Building the
// cross-product pseudonym table is out of scope here (Ф1 is per-product).

import type { Prisma, PrismaClient } from '@prisma/client';
import { validateEvent, RawEvent } from './schema';

type Db = Pick<PrismaClient, 'analyticsEvent' | 'analyticsEventRejected' | 'user'>;

export type IngestResult =
    | { accepted: true }
    | { accepted: false; reason: string };

export async function processIngestEvent(db: Db, raw: RawEvent, now: Date = new Date()): Promise<IngestResult> {
    const validation = validateEvent(raw);
    if (!validation.valid) {
        await db.analyticsEventRejected.create({
            data: { reason: validation.reason, payload: raw as object },
        });
        return { accepted: false, reason: validation.reason };
    }

    const accountId = raw.account_id as string;
    const user = await db.user.findUnique({ where: { id: accountId }, select: { id: true, analyticsConsentAt: true } });
    if (!user) {
        await db.analyticsEventRejected.create({
            data: { reason: 'unknown account_id', payload: raw as object },
        });
        return { accepted: false, reason: 'unknown account_id' };
    }

    const event = raw.event as string;
    const props = (raw.props ?? {}) as Record<string, unknown>;
    let deviceId = (raw.device_id ?? null) as string | null;
    let consentGiven = user.analyticsConsentAt !== null;

    if (event === 'consent_updated') {
        const granted = props.granted === true;
        await db.user.update({ where: { id: accountId }, data: { analyticsConsentAt: granted ? now : null } });
        consentGiven = granted;
    }

    // Rule: no device_id is written to `events` before consent is on file
    // (checked *after* this event's own consent_updated is applied, so the
    // granting event itself can carry its device_id).
    if (!consentGiven) deviceId = null;

    await db.analyticsEvent.create({
        data: {
            event,
            ts: new Date(raw.ts as string),
            product: raw.product as string,
            accountId,
            deviceId,
            props: props as Prisma.InputJsonValue,
            schemaVersion: raw.schema_version as number,
        },
    });

    return { accepted: true };
}
