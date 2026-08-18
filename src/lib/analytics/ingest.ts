// Core POST /ingest processing (charter/12_ANALYTICS.md §3), kept separate
// from the route handler so it's testable against a mocked Prisma client.
//
// Simplification worth flagging: charter/12_ANALYTICS.md §2 describes
// account_id as a cross-product pseudonym distinct from any provider ID.
// cmpas.ru doesn't have that separate identity table yet, so this treats
// account_id as this product's User.id — the same value already used
// everywhere else in this codebase as the account identifier. Building the
// cross-product pseudonym table is out of scope here (Ф1 is per-product).
//
// O-260817-13: a device without an account (МОМЕНТЫ has none, ЗАПИСКИ has no
// production login yet) may send device_id in place of account_id. Its
// consent lives in AnalyticsDeviceConsent, independent of
// User.analyticsConsentAt — when identity_linked later ties the device to an
// account, past rows are not rewritten; joining them is a mart-layer concern.

import type { Prisma, PrismaClient } from '@prisma/client';
import { validateEvent, RawEvent } from './schema';
import { isRateLimited, defaultRateLimitStore } from './rate-limit';

type Db = Pick<PrismaClient, 'analyticsEvent' | 'analyticsEventRejected' | 'user' | 'analyticsDeviceConsent'>;

export type IngestResult =
    | { accepted: true }
    | { accepted: false; reason: string };

export async function processIngestEvent(
    db: Db,
    raw: RawEvent,
    now: Date = new Date(),
    rateLimitStore: Map<string, number[]> = defaultRateLimitStore,
): Promise<IngestResult> {
    const validation = validateEvent(raw);
    if (!validation.valid) {
        await db.analyticsEventRejected.create({
            data: { reason: validation.reason, payload: raw as object },
        });
        return { accepted: false, reason: validation.reason };
    }

    const accountId = (raw.account_id ?? null) as string | null;
    const deviceId = (raw.device_id ?? null) as string | null;

    if (deviceId && isRateLimited(deviceId, now.getTime(), rateLimitStore)) {
        return { accepted: false, reason: 'rate limited' };
    }

    const event = raw.event as string;
    const props = (raw.props ?? {}) as Record<string, unknown>;

    if (accountId) {
        return writeAccountEvent(db, raw, accountId, deviceId, event, props, now);
    }
    return writeDeviceOnlyEvent(db, raw, deviceId as string, event, props, now);
}

async function writeAccountEvent(
    db: Db,
    raw: RawEvent,
    accountId: string,
    deviceId: string | null,
    event: string,
    props: Record<string, unknown>,
    now: Date,
): Promise<IngestResult> {
    const user = await db.user.findUnique({ where: { id: accountId }, select: { id: true, analyticsConsentAt: true } });
    if (!user) {
        await db.analyticsEventRejected.create({
            data: { reason: 'unknown account_id', payload: raw as object },
        });
        return { accepted: false, reason: 'unknown account_id' };
    }

    let consentGiven = user.analyticsConsentAt !== null;

    if (event === 'consent_updated') {
        const granted = props.granted === true;
        await db.user.update({ where: { id: accountId }, data: { analyticsConsentAt: granted ? now : null } });
        consentGiven = granted;
    }

    // Rule: no device_id is written to `events` before consent is on file
    // (checked *after* this event's own consent_updated is applied, so the
    // granting event itself can carry its device_id).
    await db.analyticsEvent.create({
        data: {
            event,
            ts: new Date(raw.ts as string),
            product: raw.product as string,
            accountId,
            deviceId: consentGiven ? deviceId : null,
            props: props as Prisma.InputJsonValue,
            schemaVersion: raw.schema_version as number,
        },
    });

    return { accepted: true };
}

async function writeDeviceOnlyEvent(
    db: Db,
    raw: RawEvent,
    deviceId: string,
    event: string,
    props: Record<string, unknown>,
    now: Date,
): Promise<IngestResult> {
    const existing = await db.analyticsDeviceConsent.findUnique({ where: { deviceId } });
    let consentGiven = existing?.consentAt != null;

    if (event === 'consent_updated') {
        const granted = props.granted === true;
        await db.analyticsDeviceConsent.upsert({
            where: { deviceId },
            create: { deviceId, consentAt: granted ? now : null },
            update: { consentAt: granted ? now : null },
        });
        consentGiven = granted;
    }

    // No account to fall back on: without consent there is nothing lawful
    // to record for this device at all, unlike the account path where the
    // event is still written with device_id stripped.
    if (!consentGiven) {
        await db.analyticsEventRejected.create({
            data: { reason: 'consent required for a device without an account', payload: raw as object },
        });
        return { accepted: false, reason: 'consent required for a device without an account' };
    }

    await db.analyticsEvent.create({
        data: {
            event,
            ts: new Date(raw.ts as string),
            product: raw.product as string,
            accountId: null,
            deviceId,
            props: props as Prisma.InputJsonValue,
            schemaVersion: raw.schema_version as number,
        },
    });

    return { accepted: true };
}
