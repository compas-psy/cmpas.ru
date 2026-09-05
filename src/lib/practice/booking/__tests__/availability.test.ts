// Task 6 (PRAKTIKA MVP): regression test for the maxSessionsPerDay bug —
// the old inline resolver capped candidate generation against
// `bookedCount + <options already generated this render>`, not real
// bookings. With multiple ScheduleRules on the same day, a rule processed
// later would get starved by earlier rules' candidate count alone, even
// with zero actual DiarySession rows booked that day.
//
// Mandatory fixture (per the Task 6 spec):
//   Monday
//   Rule A: 09:00-13:00 online, duration 50
//   Rule B: 15:00-21:00 offline, address=Яузская, duration 50
//   maxSessionsPerDay=4
//   bookedCount=0
// Expected: slots exist in both morning AND evening — specifically, more
// than the single 15:00 slot the old (bugged) formula would have allowed
// through before hitting its (wrong) cap.

import { describe, it, expect } from 'vitest';
import { resolveAvailableTimesForDay } from '../availability';
import type { AvailabilitySlotInput, ScheduleRuleInput } from '../types';

const MONDAY = '2026-09-07'; // a real Monday, far enough in the future to be outside any buffer/horizon edge case

function ruleA(): ScheduleRuleInput {
    return {
        id: 'rule-a',
        isActive: true,
        format: 'online',
        addressId: null,
        duration: 50,
        breakDuration: 15,
        audienceFilter: 'all',
        startDate: null,
        endDate: null,
    };
}

function ruleB(): ScheduleRuleInput {
    return {
        id: 'rule-b',
        isActive: true,
        format: 'offline',
        addressId: 'address-yauzskaya',
        duration: 50,
        breakDuration: 15,
        audienceFilter: 'all',
        startDate: null,
        endDate: null,
    };
}

function slotFor(rule: ScheduleRuleInput, id: string, startTime: string, endTime: string): AvailabilitySlotInput {
    return {
        id,
        dayOfWeek: 0, // Monday
        startTime,
        endTime,
        duration: null,
        format: null,
        addressId: null,
        startDate: null,
        endDate: null,
        scheduleRuleId: rule.id,
        scheduleRule: rule,
    };
}

function resolveFixture(maxSessionsPerDay: number | null) {
    return resolveAvailableTimesForDay({
        dateStr: MONDAY,
        slots: [
            slotFor(ruleA(), 'slot-a', '09:00', '13:00'),
            slotFor(ruleB(), 'slot-b', '15:00', '21:00'),
        ],
        blocks: [],
        sessions: [],
        settings: { maxSessionsPerDay, sessionBreak: 15, bookingBufferHours: 0, bookingHorizonDays: 365 },
        skipBuffer: true,
    });
}

describe('resolveAvailableTimesForDay — multiple ScheduleRules on the same day', () => {
    it('produces slots in both the morning (Rule A) and evening (Rule B) windows', () => {
        const result = resolveFixture(4);
        const morning = result.filter(s => s.time < '13:00');
        const evening = result.filter(s => s.time >= '15:00');

        expect(morning.length).toBeGreaterThan(0);
        expect(evening.length).toBeGreaterThan(0);
    });

    it('does not starve the evening rule just because the morning rule generated candidates first (the bookedCount+generatedOptions bug)', () => {
        // With 0 real bookings, maxSessionsPerDay must never truncate candidate
        // generation — it only means "don't show slots once the day is
        // actually fully booked". The old formula would cut Rule B off after
        // its very first candidate (15:00) once the running total of
        // GENERATED options (not real bookings) reached 4.
        const result = resolveFixture(4);
        const evening = result.filter(s => s.time >= '15:00').map(s => s.time);

        expect(evening.length).toBeGreaterThan(1);
        expect(evening).toContain('17:10');
    });

    it('with zero real bookings, ALL geometrically valid candidates from both rules are returned regardless of maxSessionsPerDay', () => {
        const uncapped = resolveFixture(null);
        const capped = resolveFixture(4);

        expect(capped).toEqual(uncapped);
        expect(capped.length).toBe(8); // 3 from Rule A (09:00,10:05,11:10) + 5 from Rule B (15:00..19:20)
    });

    it('once real bookings reach the cap, the day offers nothing further', () => {
        const result = resolveAvailableTimesForDay({
            dateStr: MONDAY,
            slots: [slotFor(ruleA(), 'slot-a', '09:00', '13:00'), slotFor(ruleB(), 'slot-b', '15:00', '21:00')],
            blocks: [],
            sessions: [
                { date: new Date(`${MONDAY}T00:00:00.000Z`), time: '09:00', duration: 50, clientId: 'c1' },
                { date: new Date(`${MONDAY}T00:00:00.000Z`), time: '10:00', duration: 50, clientId: 'c2' },
                { date: new Date(`${MONDAY}T00:00:00.000Z`), time: '11:00', duration: 50, clientId: 'c3' },
                { date: new Date(`${MONDAY}T00:00:00.000Z`), time: '12:00', duration: 50, clientId: 'c4' },
            ],
            settings: { maxSessionsPerDay: 4, sessionBreak: 15, bookingBufferHours: 0, bookingHorizonDays: 365 },
            skipBuffer: true,
        });

        expect(result).toEqual([]);
    });

    it('each option carries availabilitySlotId, scheduleRuleId, format, addressId, duration', () => {
        const [first] = resolveFixture(null);
        expect(first).toMatchObject({
            availabilitySlotId: expect.any(String),
            scheduleRuleId: expect.any(String),
            format: expect.any(String),
            duration: expect.any(Number),
        });
        expect('addressId' in first).toBe(true);
    });

    it('same clock time, same format, but different rule/address never overwrite one another', () => {
        const ruleC: ScheduleRuleInput = { ...ruleB(), id: 'rule-c', addressId: 'address-other-office' };
        const result = resolveAvailableTimesForDay({
            dateStr: MONDAY,
            slots: [
                slotFor(ruleB(), 'slot-b', '15:00', '16:00'),
                slotFor(ruleC, 'slot-c', '15:00', '16:00'),
            ],
            blocks: [],
            sessions: [],
            settings: { maxSessionsPerDay: null, sessionBreak: 15, bookingBufferHours: 0, bookingHorizonDays: 365 },
            skipBuffer: true,
        });

        const at1500 = result.filter(s => s.time === '15:00');
        expect(at1500).toHaveLength(2);
        expect(at1500.map(s => s.addressId).sort()).toEqual(['address-other-office', 'address-yauzskaya']);
    });

    it('overlapping rules with IDENTICAL user-visible semantics collapse into ONE option, not a visual duplicate', () => {
        // Two different ScheduleRules, same time/format/address/duration —
        // to the client this is one "15:00 · очно · Яузская" button, not
        // two. Internally, exactly one canonical availabilitySlotId/
        // scheduleRuleId must be chosen, deterministically.
        const ruleD: ScheduleRuleInput = { ...ruleB(), id: 'rule-d' };
        const result = resolveAvailableTimesForDay({
            dateStr: MONDAY,
            slots: [
                slotFor(ruleB(), 'slot-b', '15:00', '16:00'),
                slotFor(ruleD, 'slot-d', '15:00', '16:00'),
            ],
            blocks: [],
            sessions: [],
            settings: { maxSessionsPerDay: null, sessionBreak: 15, bookingBufferHours: 0, bookingHorizonDays: 365 },
            skipBuffer: true,
        });

        const at1500 = result.filter(s => s.time === '15:00');
        expect(at1500).toHaveLength(1);
        // Deterministic canonical pick — lowest (scheduleRuleId, availabilitySlotId).
        expect(at1500[0].scheduleRuleId).toBe('rule-b');
        expect(at1500[0].availabilitySlotId).toBe('slot-b');

        // Order of the input slots must not change the outcome.
        const reversed = resolveAvailableTimesForDay({
            dateStr: MONDAY,
            slots: [
                slotFor(ruleD, 'slot-d', '15:00', '16:00'),
                slotFor(ruleB(), 'slot-b', '15:00', '16:00'),
            ],
            blocks: [],
            sessions: [],
            settings: { maxSessionsPerDay: null, sessionBreak: 15, bookingBufferHours: 0, bookingHorizonDays: 365 },
            skipBuffer: true,
        });
        expect(reversed.filter(s => s.time === '15:00')).toEqual(at1500);
    });

    it('rules differing only by duration are NOT collapsed — duration changes the booking outcome', () => {
        const shortRule: ScheduleRuleInput = { ...ruleB(), id: 'rule-short', duration: 30 };
        const result = resolveAvailableTimesForDay({
            dateStr: MONDAY,
            slots: [
                slotFor(ruleB(), 'slot-b', '15:00', '16:00'),
                slotFor(shortRule, 'slot-short', '15:00', '16:00'),
            ],
            blocks: [],
            sessions: [],
            settings: { maxSessionsPerDay: null, sessionBreak: 15, bookingBufferHours: 0, bookingHorizonDays: 365 },
            skipBuffer: true,
        });

        const at1500 = result.filter(s => s.time === '15:00');
        expect(at1500).toHaveLength(2);
        expect(at1500.map(s => s.duration).sort()).toEqual([30, 50]);
    });

    it('audience filter still applies per rule (new vs regular vs all)', () => {
        const newOnlyRule: ScheduleRuleInput = { ...ruleA(), id: 'rule-new-only', audienceFilter: 'new' };
        const result = resolveAvailableTimesForDay({
            dateStr: MONDAY,
            slots: [slotFor(newOnlyRule, 'slot-new', '09:00', '10:00')],
            blocks: [],
            sessions: [],
            settings: { maxSessionsPerDay: null, sessionBreak: 15, bookingBufferHours: 0, bookingHorizonDays: 365 },
            skipBuffer: true,
            clientId: 'existing-client', // -> audience = "regular"
        });

        expect(result).toEqual([]);
    });

    it('DiaryBlock rows exclude overlapping candidates', () => {
        const result = resolveAvailableTimesForDay({
            dateStr: MONDAY,
            slots: [slotFor(ruleA(), 'slot-a', '09:00', '10:00')],
            blocks: [{ date: new Date(`${MONDAY}T00:00:00.000Z`), startTime: '09:00', endTime: '09:30' }],
            sessions: [],
            settings: { maxSessionsPerDay: null, sessionBreak: 15, bookingBufferHours: 0, bookingHorizonDays: 365 },
            skipBuffer: true,
        });

        expect(result).toEqual([]);
    });

    it('a date before today is always empty, regardless of rules', () => {
        const result = resolveAvailableTimesForDay({
            dateStr: '2020-01-06', // a Monday far in the past
            slots: [slotFor(ruleA(), 'slot-a', '09:00', '13:00')],
            blocks: [],
            sessions: [],
            settings: null,
            skipBuffer: true,
        });

        expect(result).toEqual([]);
    });
});
