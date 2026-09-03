// Task 7 (PRAKTIKA MVP): slotToken is the exclusive, tamper-proof carrier of
// exact slot identity between "here's what's available" and "book this".

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { slotToken, verifySlotToken, type SlotIdentity } from '../slot-token';

const IDENTITY: SlotIdentity = {
    psychologistId: 'psy-1',
    dateStr: '2026-09-07',
    time: '15:00',
    availabilitySlotId: 'slot-b',
    scheduleRuleId: 'rule-b',
    format: 'offline',
    addressId: 'address-yauzskaya',
    duration: 50,
};

describe('slotToken / verifySlotToken', () => {
    beforeEach(() => {
        process.env.AUTH_SECRET = 'test-secret-value';
    });

    it('round-trips the exact identity it was minted for', () => {
        const token = slotToken(IDENTITY);
        const verified = verifySlotToken('psy-1', token);
        expect(verified).toEqual(IDENTITY);
    });

    it('rejects a token minted for a different psychologist', () => {
        const token = slotToken(IDENTITY);
        expect(verifySlotToken('psy-someone-else', token)).toBeNull();
    });

    it('rejects a tampered token — changing any field invalidates the signature', () => {
        const token = slotToken(IDENTITY);
        // Flip a character in the middle of the encoded payload (not the last
        // char — base64url's trailing group can tolerate a flip with no
        // decoded-byte change, see client-workflow.test.ts's note on this).
        const mid = Math.floor(token.length / 2);
        const tampered = token.slice(0, mid) + (token[mid] === 'a' ? 'b' : 'a') + token.slice(mid + 1);
        expect(verifySlotToken('psy-1', tampered)).toBeNull();
    });

    it('rejects a token whose duration was edited to a different value', () => {
        // Can't just re-sign with a forged payload without the secret, but we
        // CAN simulate "attacker edits the plaintext without re-signing" by
        // decoding, changing a field, and re-encoding with the OLD signature.
        const token = slotToken(IDENTITY);
        const raw = Buffer.from(token.slice('slt1_'.length), 'base64url').toString('utf8');
        const parts = raw.split('|');
        parts[7] = '90'; // duration field
        const forged = 'slt1_' + Buffer.from(parts.join('|')).toString('base64url');
        expect(verifySlotToken('psy-1', forged)).toBeNull();
    });

    it('rejects an expired token', () => {
        vi.useFakeTimers({ toFake: ['Date'] });
        try {
            const mintedAt = Date.now();
            const token = slotToken(IDENTITY, mintedAt);
            vi.setSystemTime(mintedAt + 16 * 60 * 1000); // 16 minutes later
            expect(verifySlotToken('psy-1', token)).toBeNull();
        } finally {
            vi.useRealTimers();
        }
    });

    it('accepts a token right up to the 15-minute boundary', () => {
        vi.useFakeTimers({ toFake: ['Date'] });
        try {
            const mintedAt = Date.now();
            const token = slotToken(IDENTITY, mintedAt);
            vi.setSystemTime(mintedAt + 14 * 60 * 1000 + 59_000);
            expect(verifySlotToken('psy-1', token)).not.toBeNull();
        } finally {
            vi.useRealTimers();
        }
    });

    it('rejects garbage input without throwing', () => {
        expect(verifySlotToken('psy-1', null)).toBeNull();
        expect(verifySlotToken('psy-1', undefined)).toBeNull();
        expect(verifySlotToken('psy-1', '')).toBeNull();
        expect(verifySlotToken('psy-1', 'not-a-real-token')).toBeNull();
        expect(verifySlotToken('psy-1', 'slt1_%%%invalid-base64%%%')).toBeNull();
    });

    it('rejects an old sessionActionToken-shaped string (different prefix)', () => {
        expect(verifySlotToken('psy-1', 'sat1_abcdef')).toBeNull();
    });

    it('preserves a null scheduleRuleId/addressId round-trip (slot with no parent rule / online format)', () => {
        const onlineIdentity: SlotIdentity = { ...IDENTITY, format: 'online', addressId: null, scheduleRuleId: null };
        const token = slotToken(onlineIdentity);
        expect(verifySlotToken('psy-1', token)).toEqual(onlineIdentity);
    });
});
