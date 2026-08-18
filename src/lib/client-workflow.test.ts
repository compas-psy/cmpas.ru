import { describe, expect, it, vi } from 'vitest';

// client-workflow.ts imports `db` at module scope for its document/consent
// helpers, unused by the token functions under test here — mocked so
// importing the module never touches Prisma.
vi.mock('@/lib/db', () => ({ db: {} }));

const { clientBookingLink, personalClientToken, resolvePersonalClientToken } = await import('./client-workflow');

const DAY_MS = 24 * 60 * 60 * 1000;

describe('personalClientToken / resolvePersonalClientToken', () => {
    it('round-trips a freshly issued token back to the same clientId', () => {
        const token = personalClientToken('client-123');
        const resolved = resolvePersonalClientToken(token);
        expect(resolved).toEqual({ clientId: 'client-123', legacy: false });
    });

    it('rejects a tampered token', () => {
        const token = personalClientToken('client-123');
        const tampered = token.slice(0, -1) + (token.at(-1) === 'a' ? 'b' : 'a');
        expect(resolvePersonalClientToken(tampered)).toBeNull();
    });

    it('rejects an expired token (issued more than 30 days ago)', () => {
        const issuedAt = Date.now() - 31 * DAY_MS;
        const token = personalClientToken('client-123', issuedAt);
        expect(resolvePersonalClientToken(token)).toBeNull();
    });

    it('accepts a token right at the edge of the 30-day window', () => {
        const issuedAt = Date.now() - 29 * DAY_MS;
        const token = personalClientToken('client-123', issuedAt);
        expect(resolvePersonalClientToken(token)).toEqual({ clientId: 'client-123', legacy: false });
    });

    it('accepts a legacy raw clientId (pre-fix links) and marks it as legacy', () => {
        const resolved = resolvePersonalClientToken('clzk8f2p90001qw3h5x9k2m4v');
        expect(resolved).toEqual({ clientId: 'clzk8f2p90001qw3h5x9k2m4v', legacy: true });
    });

    it('returns null for an empty or missing token', () => {
        expect(resolvePersonalClientToken('')).toBeNull();
        expect(resolvePersonalClientToken(null)).toBeNull();
        expect(resolvePersonalClientToken(undefined)).toBeNull();
    });
});

describe('clientBookingLink', () => {
    it('omits the c param entirely when there is no clientId', () => {
        const link = clientBookingLink('psy-1', '');
        expect(link).toBe('https://cmpas.ru/bot/book/psy-1');
    });

    it('signs the clientId into a token that resolves back correctly', () => {
        const link = clientBookingLink('psy-1', 'client-123');
        const url = new URL(link);
        expect(url.pathname).toBe('/bot/book/psy-1');
        const token = url.searchParams.get('c');
        expect(token).toMatch(/^st1_/);
        expect(resolvePersonalClientToken(token)).toEqual({ clientId: 'client-123', legacy: false });
    });
});
