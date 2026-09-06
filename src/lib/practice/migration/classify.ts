// Task 11 — Import preview/classification/matching.
//
// Founder correction: this used to `continue` past anything
// extract-name.ts couldn't turn into a name, and treated a case-insensitive
// name match as an auto-resolved client. Neither is acceptable: a
// non-matching event still needs to be visible to the psychologist (as
// 'personal' or 'uncertain', never silently dropped), and a name match is
// only ever a *suggestion* — see src/lib/clients/match.ts for why.
//
// Every source event lands in exactly one (classification, reviewState)
// pair. 'ready' — auto-selected on import — is reserved for a strong
// (phone/email) identity match; calendar events essentially never carry
// one (Task 10's PracticeSourceEvent has no phone/email field), so nearly
// everything here ends up 'review' or 'personal' by design. Task 13's
// CSV/XLSX import (which CAN carry phone/email columns) reuses
// matchClientIdentity and can produce real 'ready' rows.
import { extractClientNameFromSummary, isObviousNonClientSummary } from '@/lib/clients/extract-name';
import { matchClientIdentity, type ClientIdentity, type MatchReason, type MatchConfidence } from '@/lib/clients/match';
import type { PracticeSourceEvent } from './types';

export type ImportClassification = 'session' | 'client_only' | 'personal' | 'uncertain' | 'skipped';
export type ImportReviewState = 'ready' | 'review' | 'personal' | 'skipped';

export interface ImportCandidate {
    id: string;
    provider: PracticeSourceEvent['provider'];
    integrationId: string;
    externalEventId: string;
    externalSeriesId: string | null;
    summary: string;
    date: string;
    startTime: string;
    endTime: string;
    duration: number;
    format: 'online' | 'offline';
    addressId: string | null;

    classification: ImportClassification;
    reviewState: ImportReviewState;
    confidence: MatchConfidence;
    matchReason: MatchReason;

    proposedClientName: string | null;
    suggestedClientId: string | null;
    resolvedClientId: string | null;
}

/** `integrationId::externalEventId` — the same key shape callers use to build `linkedEventKeys` from CalendarSessionLink rows. */
export function importLinkKey(integrationId: string, externalEventId: string): string {
    return `${integrationId}::${externalEventId}`;
}

/**
 * Task 12 (founder correction): the old (date, time, clientName) heuristic
 * guessed at "already imported" from display fields — two genuinely
 * different sessions could collide on it, and a renamed client would evade
 * it. `linkedEventKeys` is now built by the caller from real
 * CalendarSessionLink rows (src/lib/practice/migration/commit.ts's
 * idempotency source of truth) — an event is 'skipped' here if and only if
 * it was actually already committed as a session.
 */
export function classifyCalendarEvents(
    events: PracticeSourceEvent[],
    existingClients: ClientIdentity[],
    linkedEventKeys: Set<string>,
): ImportCandidate[] {
    return events.map((event) => classifyOne(event, existingClients, linkedEventKeys));
}

function classifyOne(
    event: PracticeSourceEvent,
    existingClients: ClientIdentity[],
    linkedEventKeys: Set<string>,
): ImportCandidate {
    const base = {
        id: `${event.provider}:${event.integrationId}:${event.externalEventId}`,
        provider: event.provider,
        integrationId: event.integrationId,
        externalEventId: event.externalEventId,
        externalSeriesId: event.externalSeriesId,
        summary: event.summary,
        date: event.date,
        startTime: event.startTime,
        endTime: event.endTime,
        duration: Math.max(15, Math.round((event.end.getTime() - event.start.getTime()) / 60000)),
        // Task 10's PracticeSourceEvent carries no location/description, so
        // there is no online-link heuristic to run yet — every candidate
        // defaults to online/no cabinet; the psychologist corrects it in
        // the preview UI when it's wrong (see import-calendar/page.tsx).
        format: 'online' as const,
        addressId: null as string | null,
    };

    // Already committed as a session in an earlier import — checked FIRST,
    // regardless of classification: the psychologist could have overridden
    // ANY event (even one that classifies 'uncertain' or 'personal' here)
    // to 'session' and imported it, so a linked event must never resurface
    // as a fresh candidate no matter what it looks like this time around.
    if (linkedEventKeys.has(importLinkKey(event.integrationId, event.externalEventId))) {
        return {
            ...base,
            classification: 'skipped',
            reviewState: 'skipped',
            confidence: 'high',
            matchReason: 'none',
            proposedClientName: null,
            suggestedClientId: null,
            resolvedClientId: null,
        };
    }

    // All-day entries ("Отпуск", a public holiday, ...) still block
    // availability (Task 10 busy-blocks.ts), but are never a session
    // candidate — always personal, always unchecked by default.
    if (event.allDay) {
        return {
            ...base,
            classification: 'personal',
            reviewState: 'personal',
            confidence: 'high',
            matchReason: 'none',
            proposedClientName: null,
            suggestedClientId: null,
            resolvedClientId: null,
        };
    }

    const extractedName = extractClientNameFromSummary(event.summary);

    if (extractedName) {
        const match = matchClientIdentity({ name: extractedName }, existingClients);
        return {
            ...base,
            classification: 'session',
            reviewState: match.resolvedClientId ? 'ready' : 'review',
            confidence: match.confidence,
            matchReason: match.matchReason,
            proposedClientName: extractedName,
            suggestedClientId: match.suggestedClientId,
            resolvedClientId: match.resolvedClientId,
        };
    }

    if (isObviousNonClientSummary(event.summary)) {
        return {
            ...base,
            classification: 'personal',
            reviewState: 'personal',
            confidence: 'high',
            matchReason: 'none',
            proposedClientName: null,
            suggestedClientId: null,
            resolvedClientId: null,
        };
    }

    // Timed, not a recognized personal keyword, but extract-name.ts found
    // no name either (e.g. no capitalized words) — genuinely unknown, not
    // dismissed. Surfaced for review, never dropped.
    return {
        ...base,
        classification: 'uncertain',
        reviewState: 'review',
        confidence: 'low',
        matchReason: 'none',
        proposedClientName: null,
        suggestedClientId: null,
        resolvedClientId: null,
    };
}

export interface ImportCounts {
    ready: number;
    review: number;
    personal: number;
    skipped: number;
}

export function countByReviewState(items: ImportCandidate[]): ImportCounts {
    const counts: ImportCounts = { ready: 0, review: 0, personal: 0, skipped: 0 };
    for (const item of items) counts[item.reviewState]++;
    return counts;
}
