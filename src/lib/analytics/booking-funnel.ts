// Booking funnel events (O-260817-11 · state/15_ORDERS.md,
// product/dashboard/TZ_management_dashboard.md §7). Goes through the same
// POST /ingest validation as every other event (src/lib/analytics/ingest.ts)
// and the same flag (ANALYTICS_INGEST_ENABLED) — no separate switch, per the
// order's own instruction. account_id is the psychologist's User.id, same
// convention as the billing events: clients have no account in cmpas.ru.

import type { PrismaClient } from '@prisma/client';
import { isIngestEnabled } from './flags';
import { processIngestEvent, IngestResult } from './ingest';
import { BookingFunnelStep, BookingFunnelContext, BookingCreatedBy } from './booking-funnel-types';

type Db = Pick<PrismaClient, 'analyticsEvent' | 'analyticsEventRejected' | 'user'>;

const STEP_NUMBER: Record<BookingFunnelStep, number> = {
    booking_link_opened: 1,
    booking_time_selected: 2,
    booking_form_started: 3,
    booking_consent_shown: 4,
    booking_completed: 5,
};

const DISABLED: IngestResult = { accepted: false, reason: 'ingest disabled' };

export async function trackBookingFunnelStep(
    db: Db,
    psychologistId: string,
    step: BookingFunnelStep,
    context: BookingFunnelContext,
    now: Date = new Date()
): Promise<IngestResult> {
    if (!isIngestEnabled()) return DISABLED;
    return processIngestEvent(db, {
        event: step,
        ts: now.toISOString(),
        product: 'practice',
        account_id: psychologistId,
        device_id: null,
        schema_version: 1,
        props: {
            channel: context.channel,
            link_type: context.linkType,
            known_client: context.knownClient,
            step: STEP_NUMBER[step],
        },
    });
}

export async function trackBookingCreatedBy(
    db: Db,
    psychologistId: string,
    createdBy: BookingCreatedBy,
    now: Date = new Date()
): Promise<IngestResult> {
    if (!isIngestEnabled()) return DISABLED;
    return processIngestEvent(db, {
        event: 'booking_created_by',
        ts: now.toISOString(),
        product: 'practice',
        account_id: psychologistId,
        device_id: null,
        schema_version: 1,
        props: { created_by: createdBy },
    });
}
