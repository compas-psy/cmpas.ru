import type { TimePreference } from './suggested-times';

// CJM_booking_v1.md §2 этап 3-бис (S1-R): a link stays "warm" for 30 days.
const RETURN_STATE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const VALID_PREFERENCES: TimePreference[] = ['weekday_evening', 'weekend_morning', 'any'];

export interface ReturnState {
    preference: TimePreference;
    lastVisitAt: string; // ISO
}

export function returnStateStorageKey(psychologistId: string): string {
    return `compas_return_${psychologistId}`;
}

/**
 * CJM_booking_v1.md §2 этап 3-бис: "Что помним и чего не помним" — только
 * предпочтение по времени и отметку последнего визита. Ничего больше
 * структурно не может попасть в это состояние: у ReturnState нет полей
 * для имени и контакта.
 */
export function serializeReturnState(preference: TimePreference, now: Date): string {
    const state: ReturnState = { preference, lastVisitAt: now.toISOString() };
    return JSON.stringify(state);
}

export function readReturnState(raw: string | null | undefined, now: Date): ReturnState | null {
    if (!raw) return null;

    let parsed: unknown;
    try {
        parsed = JSON.parse(raw);
    } catch {
        return null;
    }
    if (!parsed || typeof parsed !== 'object') return null;

    const { preference, lastVisitAt } = parsed as Record<string, unknown>;
    if (typeof preference !== 'string' || !VALID_PREFERENCES.includes(preference as TimePreference)) return null;
    if (typeof lastVisitAt !== 'string') return null;

    const visitedAt = new Date(lastVisitAt);
    if (Number.isNaN(visitedAt.getTime())) return null;
    if (now.getTime() - visitedAt.getTime() > RETURN_STATE_TTL_MS) return null;

    return { preference: preference as TimePreference, lastVisitAt };
}
