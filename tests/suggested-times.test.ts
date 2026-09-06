import { describe, it, expect } from 'vitest';
import { pickSuggestedTimes, SuggestedTimeCandidate } from '@/lib/booking/suggested-times';

function slot(date: string, time: string): SuggestedTimeCandidate {
    return { date, time, format: 'online', addressId: null, availabilitySlotId: `slot-${date}-${time}`, scheduleRuleId: null, duration: 50, slotToken: `token-${date}-${time}`, addressName: null };
}

describe('pickSuggestedTimes (product/practice/CJM_booking_v1.md этап 2)', () => {
    // 2026-08-17 is a Monday, 2026-08-22 is a Saturday.
    const candidates = [
        slot('2026-08-17', '10:00'), // Mon morning
        slot('2026-08-17', '19:00'), // Mon evening — weekday_evening match
        slot('2026-08-18', '20:00'), // Tue evening — weekday_evening match
        slot('2026-08-22', '09:00'), // Sat morning — weekend_morning match
        slot('2026-08-22', '15:00'), // Sat afternoon
        slot('2026-08-23', '10:00'), // Sun morning — weekend_morning match
    ];

    it('returns the nearest three slots for "any", soonest first', () => {
        const result = pickSuggestedTimes(candidates, 'any');
        expect(result).toEqual([
            slot('2026-08-17', '10:00'),
            slot('2026-08-17', '19:00'),
            slot('2026-08-18', '20:00'),
        ]);
    });

    it('matches weekday evenings only', () => {
        const result = pickSuggestedTimes(candidates, 'weekday_evening', 2);
        expect(result).toEqual([
            slot('2026-08-17', '19:00'),
            slot('2026-08-18', '20:00'),
        ]);
    });

    it('matches weekend mornings only', () => {
        const result = pickSuggestedTimes(candidates, 'weekend_morning', 2);
        expect(result).toEqual([
            slot('2026-08-22', '09:00'),
            slot('2026-08-23', '10:00'),
        ]);
    });

    it('fills up to `count` with the nearest remaining slots when a preference has too few matches', () => {
        const sparse = [slot('2026-08-22', '09:00'), slot('2026-08-17', '10:00'), slot('2026-08-17', '19:00')];
        const result = pickSuggestedTimes(sparse, 'weekend_morning', 3);
        expect(result).toHaveLength(3);
        expect(result[0]).toEqual(slot('2026-08-22', '09:00')); // the one real match stays first
    });

    it('returns fewer than `count` when there simply aren\'t enough candidates', () => {
        const result = pickSuggestedTimes([slot('2026-08-17', '19:00')], 'any', 3);
        expect(result).toHaveLength(1);
    });

    it('returns an empty array for an empty schedule — this is what triggers the waitlist offer', () => {
        expect(pickSuggestedTimes([], 'any')).toEqual([]);
    });
});
