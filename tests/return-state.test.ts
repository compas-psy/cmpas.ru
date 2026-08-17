import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import {
    readReturnState,
    serializeReturnState,
    returnStateStorageKey,
} from '@/lib/booking/return-state';

describe('return-state (CJM_booking_v1.md §2 этап 3-бис, S1-R)', () => {
    it('reads back exactly what was serialized, within the 30-day window', () => {
        const now = new Date('2026-08-17T12:00:00Z');
        const raw = serializeReturnState('weekend_morning', now);
        expect(readReturnState(raw, now)).toEqual({
            preference: 'weekend_morning',
            lastVisitAt: now.toISOString(),
        });
    });

    it('is still valid one second short of 30 days', () => {
        const visitedAt = new Date('2026-08-17T12:00:00Z');
        const raw = serializeReturnState('any', visitedAt);
        const almostExpired = new Date(visitedAt.getTime() + 30 * 24 * 60 * 60 * 1000 - 1000);
        expect(readReturnState(raw, almostExpired)).not.toBeNull();
    });

    it('expires once 30 days have passed', () => {
        const visitedAt = new Date('2026-08-17T12:00:00Z');
        const raw = serializeReturnState('weekday_evening', visitedAt);
        const expired = new Date(visitedAt.getTime() + 30 * 24 * 60 * 60 * 1000 + 1000);
        expect(readReturnState(raw, expired)).toBeNull();
    });

    it('returns null for missing, malformed, or non-JSON input', () => {
        const now = new Date('2026-08-17T12:00:00Z');
        expect(readReturnState(null, now)).toBeNull();
        expect(readReturnState(undefined, now)).toBeNull();
        expect(readReturnState('', now)).toBeNull();
        expect(readReturnState('not json', now)).toBeNull();
        expect(readReturnState('{}', now)).toBeNull();
        expect(readReturnState('null', now)).toBeNull();
        expect(readReturnState('42', now)).toBeNull();
    });

    it('rejects an unrecognized preference value', () => {
        const now = new Date('2026-08-17T12:00:00Z');
        const raw = JSON.stringify({ preference: 'weekday_afternoon', lastVisitAt: now.toISOString() });
        expect(readReturnState(raw, now)).toBeNull();
    });

    it('rejects an unparseable lastVisitAt', () => {
        const raw = JSON.stringify({ preference: 'any', lastVisitAt: 'not-a-date' });
        expect(readReturnState(raw, new Date('2026-08-17T12:00:00Z'))).toBeNull();
    });

    it('stores only preference and lastVisitAt — no name, no contact, no form fields', () => {
        const now = new Date('2026-08-17T12:00:00Z');
        const raw = serializeReturnState('any', now);
        const parsed = JSON.parse(raw);
        expect(Object.keys(parsed).sort()).toEqual(['lastVisitAt', 'preference']);
        // Explicit guard against the exact fields the spec forbids.
        expect(parsed).not.toHaveProperty('name');
        expect(parsed).not.toHaveProperty('contact');
        expect(parsed).not.toHaveProperty('phone');
    });

    it('scopes the storage key to the psychologist link, not a global key', () => {
        expect(returnStateStorageKey('psy-a')).not.toBe(returnStateStorageKey('psy-b'));
        expect(returnStateStorageKey('psy-a')).toBe('compas_return_psy-a');
    });

    it('is a pure client-side read/write with no network or messaging import — a return visit cannot trigger an outbound message', () => {
        const source = readFileSync(new URL('../src/lib/booking/return-state.ts', import.meta.url), 'utf-8');
        const importLines = source.split('\n').filter(l => l.trim().startsWith('import'));
        expect(importLines).toEqual(["import type { TimePreference } from './suggested-times';"]);
        expect(source).not.toMatch(/fetch\(/);
        expect(source).not.toMatch(/from ['"]\.\.\/\.\.\/app/);
    });
});
