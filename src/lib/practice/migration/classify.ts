// Task 11 — Import preview/classification/matching.
//
// Classification: reuses extract-name.ts's existing name-extraction/
// STOP_WORDS logic (already proven on real calendars via the Task-11-era
// disconnected `scanCalendarForClients` flow) instead of the old preview
// route's crude `cleanClientName` prefix-strip, which had no way to reject
// "Обед"/"Планёрка"/etc. — anything extract-name.ts can't turn into a name
// is not an import candidate at all, not just an unlabeled one.
//
// Matching: a case-insensitive exact match against the psychologist's
// existing DiaryClient names — the same equality apply/route.ts's
// find-or-create already used pre-Task-11, just surfaced to the caller as
// `matchedClientId` instead of being decided silently at commit time.
import { extractClientNameFromSummary } from '@/lib/clients/extract-name';
import type { PracticeSourceEvent } from './types';

export interface ImportCandidate {
    id: string;
    provider: PracticeSourceEvent['provider'];
    integrationId: string;
    externalEventId: string;
    externalSeriesId: string | null;
    summary: string;
    clientName: string;
    matchedClientId: string | null;
    date: string;
    startTime: string;
    endTime: string;
    duration: number;
    duplicate: boolean;
}

export interface ExistingClientRef {
    id: string;
    name: string;
}

function normalizeName(name: string): string {
    return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** `date|startTime|normalizedClientName` — same key shape callers use to build `existingSessionKeys`. */
export function importCandidateDedupeKey(date: string, startTime: string, clientName: string): string {
    return `${date}|${startTime}|${normalizeName(clientName)}`;
}

export function classifyCalendarEvents(
    events: PracticeSourceEvent[],
    existingClients: ExistingClientRef[],
    existingSessionKeys: Set<string>,
): ImportCandidate[] {
    const clientIdByName = new Map(existingClients.map((c) => [normalizeName(c.name), c.id]));
    const candidates: ImportCandidate[] = [];

    for (const event of events) {
        // All-day entries ("Отпуск", a public holiday, ...) are never
        // bookable client sessions — they still block availability (Task 10
        // busy-blocks.ts), just not as import candidates here. Own-session
        // (PRAKTIKA-created) events are already excluded by the fetchers'
        // default includeCompasEvents=false, before this function ever sees them.
        if (event.allDay) continue;

        const clientName = extractClientNameFromSummary(event.summary);
        if (!clientName) continue;

        candidates.push({
            id: `${event.provider}:${event.integrationId}:${event.externalEventId}`,
            provider: event.provider,
            integrationId: event.integrationId,
            externalEventId: event.externalEventId,
            externalSeriesId: event.externalSeriesId,
            summary: event.summary,
            clientName,
            matchedClientId: clientIdByName.get(normalizeName(clientName)) ?? null,
            date: event.date,
            startTime: event.startTime,
            endTime: event.endTime,
            duration: Math.max(15, Math.round((event.end.getTime() - event.start.getTime()) / 60000)),
            duplicate: existingSessionKeys.has(importCandidateDedupeKey(event.date, event.startTime, clientName)),
        });
    }

    return candidates;
}
