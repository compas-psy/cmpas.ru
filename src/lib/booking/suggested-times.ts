// Mechanic B "подбор времени" (product/practice/CJM_booking_v1.md §1, этап 2):
// one preference question, 2-3 matching slots instead of a bare grid. Pure
// logic only — the DB-backed candidate list comes from src/app/bot/actions.ts
// (getAvailableDates/getAvailableTimes), this just picks and orders from it.

export type TimePreference = 'weekday_evening' | 'weekend_morning' | 'any';

export interface SuggestedTimeCandidate {
    date: string; // 'YYYY-MM-DD'
    time: string; // 'HH:MM'
    format: string;
    addressId: string | null;
    // Task 7: exact-slot identity carried through from resolveAvailableTimesForDay
    // so a suggested candidate can be turned into a signed slotToken without
    // re-resolving/guessing which rule it came from after the fact.
    availabilitySlotId: string;
    scheduleRuleId: string | null;
    duration: number;
}

function dayOfWeekMondayFirst(dateStr: string): number {
    const [y, m, d] = dateStr.split('-').map(Number);
    // 0 = Monday ... 6 = Sunday, matching src/app/bot/actions.ts's convention.
    return (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
}

// O-260829 §5.2: экспортирована для notifyWaitlistOnFreedSlot (src/lib/waitlist-notify.ts) —
// та же логика подбора "подходит ли час под предпочтение", один источник для
// предложения времени клиенту и для проверки заявки листа ожидания. Only
// date/time drive the preference match, so this takes the narrower shape —
// callers that don't have exact-slot identity (e.g. a freed-slot notice)
// don't need to fabricate one just to satisfy the type.
export function matchesPreference(candidate: Pick<SuggestedTimeCandidate, 'date' | 'time'>, preference: TimePreference): boolean {
    if (preference === 'any') return true;
    const isWeekend = dayOfWeekMondayFirst(candidate.date) >= 5;
    if (preference === 'weekday_evening') return !isWeekend && candidate.time >= '18:00';
    if (preference === 'weekend_morning') return isWeekend && candidate.time < '12:00';
    return true;
}

/**
 * Nearest slots matching the preference, soonest first. If the preference
 * doesn't have enough matches, fills the rest with the nearest remaining
 * slots rather than returning fewer than `count` — three-ish options beats
 * one, and an empty-looking screen is exactly what this mechanic replaces.
 */
export function pickSuggestedTimes(
    candidates: SuggestedTimeCandidate[],
    preference: TimePreference,
    count = 3
): SuggestedTimeCandidate[] {
    const sorted = [...candidates].sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`));
    const matches = sorted.filter(c => matchesPreference(c, preference));
    if (matches.length >= count) return matches.slice(0, count);

    const matchSet = new Set(matches);
    const rest = sorted.filter(c => !matchSet.has(c));
    return [...matches, ...rest].slice(0, count);
}
