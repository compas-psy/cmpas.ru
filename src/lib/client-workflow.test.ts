import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHash } from 'crypto';

// client-workflow.ts imports `db` at module scope for its document/consent
// helpers, unused by the token functions under test here — mocked so
// importing the module never touches Prisma.
vi.mock('@/lib/db', () => ({ db: {} }));

const {
    clientBookingLink,
    personalClientToken,
    resolvePersonalClientToken,
    resolveSignedPersonalClientToken,
    sessionActionToken,
    verifySessionActionToken,
    sessionActionTokenExpiry,
} = await import('./client-workflow');

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

// Task 3 (PRAKTIKA MVP, item A from founder review of 229d99e): before this,
// any endpoint that resolved `?c=` via resolvePersonalClientToken() still
// honored the legacy unsigned-raw-clientId path — an attacker could pass
// another client's raw id as `?c=<id>` and it would resolve exactly as if it
// were a real signed token, reopening the same IDOR the signed-token switch
// was meant to close. resolveSignedPersonalClientToken() never falls back.
describe('resolveSignedPersonalClientToken — strict, no legacy fallback ever', () => {
    it('valid signed token — resolves', () => {
        const token = personalClientToken('client-123');
        expect(resolveSignedPersonalClientToken(token)).toEqual({ clientId: 'client-123' });
    });

    it('a raw DiaryClient id passed as the token — rejected, NOT treated as a legacy clientId', () => {
        expect(resolveSignedPersonalClientToken('clzk8f2p90001qw3h5x9k2m4v')).toBeNull();
    });

    it('tampered signed token — rejected', () => {
        const token = personalClientToken('client-123');
        const tampered = token.slice(0, -1) + (token.at(-1) === 'a' ? 'b' : 'a');
        expect(resolveSignedPersonalClientToken(tampered)).toBeNull();
    });

    it('expired signed token — rejected', () => {
        const issuedAt = Date.now() - 31 * DAY_MS;
        const token = personalClientToken('client-123', issuedAt);
        expect(resolveSignedPersonalClientToken(token)).toBeNull();
    });

    it('empty/missing token — rejected', () => {
        expect(resolveSignedPersonalClientToken('')).toBeNull();
        expect(resolveSignedPersonalClientToken(null)).toBeNull();
        expect(resolveSignedPersonalClientToken(undefined)).toBeNull();
    });
});

// Task 3 (PRAKTIKA MVP, item D — founder review of 229d99e): the previous
// clientActionToken(psychologistId, clientId) was static per client — one
// token, reused across EVERY session and EVERY action (confirm/cancel/
// reschedule), never expiring. A token sent in a reminder for session A
// could cancel session B; a confirm-link could be replayed as a cancel-link.
// sessionActionToken binds psychologistId + clientId + sessionId + action +
// expiresAt, and verifySessionActionToken checks all five.
describe('sessionActionToken / verifySessionActionToken', () => {
    const future = Date.now() + 60 * 60 * 1000;

    it('round-trips: correct psy/client/session/action, not expired — verifies', () => {
        const token = sessionActionToken('psy-1', 'client-1', 'session-A', 'confirm', future);
        expect(verifySessionActionToken('psy-1', 'client-1', 'session-A', 'confirm', token)).toBe(true);
    });

    it('token issued for session A does not work on session B', () => {
        const token = sessionActionToken('psy-1', 'client-1', 'session-A', 'cancel', future);
        expect(verifySessionActionToken('psy-1', 'client-1', 'session-B', 'cancel', token)).toBe(false);
    });

    it('a confirm-token does not work as a cancel-token (same session, same client)', () => {
        const token = sessionActionToken('psy-1', 'client-1', 'session-A', 'confirm', future);
        expect(verifySessionActionToken('psy-1', 'client-1', 'session-A', 'cancel', token)).toBe(false);
    });

    it('a cancel-token does not work as a reschedule-token', () => {
        const token = sessionActionToken('psy-1', 'client-1', 'session-A', 'cancel', future);
        expect(verifySessionActionToken('psy-1', 'client-1', 'session-A', 'reschedule', token)).toBe(false);
    });

    it('token issued for one client does not work for another client on the same session', () => {
        const token = sessionActionToken('psy-1', 'client-1', 'session-A', 'confirm', future);
        expect(verifySessionActionToken('psy-1', 'client-2', 'session-A', 'confirm', token)).toBe(false);
    });

    it('token issued under one psychologist does not work under another', () => {
        const token = sessionActionToken('psy-1', 'client-1', 'session-A', 'confirm', future);
        expect(verifySessionActionToken('psy-2', 'client-1', 'session-A', 'confirm', token)).toBe(false);
    });

    it('expired token is rejected even with every other field matching', () => {
        const past = Date.now() - 1000;
        const token = sessionActionToken('psy-1', 'client-1', 'session-A', 'confirm', past);
        expect(verifySessionActionToken('psy-1', 'client-1', 'session-A', 'confirm', token)).toBe(false);
    });

    it('tampered token is rejected', () => {
        const token = sessionActionToken('psy-1', 'client-1', 'session-A', 'confirm', future);
        // Flip a character in the middle, not the last one: base64url's final
        // group can carry unused padding bits, so mutating the very last
        // character sometimes decodes back to the exact same bytes — a false
        // negative unrelated to the actual tamper-detection logic.
        const i = Math.floor(token.length / 2);
        const tampered = token.slice(0, i) + (token[i] === 'a' ? 'b' : 'a') + token.slice(i + 1);
        expect(verifySessionActionToken('psy-1', 'client-1', 'session-A', 'confirm', tampered)).toBe(false);
    });

    it('the OLD (pre-fix) unbound token format fails closed — never accepted as a fallback', () => {
        // The previous clientActionToken(psy, client) was a bare 64-char hex
        // SHA-256 digest, no prefix, no session/action/expiry. It must not
        // verify against anything now — no legacy-compatibility path exists
        // for action tokens (unlike the personal-link token's dated grace
        // window): these are short-lived by nature, so a clean cutover was
        // chosen instead of accepting stale higher-privilege links.
        const oldStyleToken = createHash('sha256').update('psy-1:client-1:whatever-secret').digest('hex');
        expect(verifySessionActionToken('psy-1', 'client-1', 'session-A', 'confirm', oldStyleToken)).toBe(false);
    });

    it('empty/missing token is rejected', () => {
        expect(verifySessionActionToken('psy-1', 'client-1', 'session-A', 'confirm', '')).toBe(false);
        expect(verifySessionActionToken('psy-1', 'client-1', 'session-A', 'confirm', null)).toBe(false);
        expect(verifySessionActionToken('psy-1', 'client-1', 'session-A', 'confirm', undefined)).toBe(false);
    });
});

describe('sessionActionTokenExpiry', () => {
    it('expires 48h after the session date/time, not 48h from mint time', () => {
        const sessionDate = new Date('2026-09-10T13:00:00.000Z');
        const expiry = sessionActionTokenExpiry(sessionDate);
        expect(expiry).toBe(sessionDate.getTime() + 48 * 60 * 60 * 1000);
    });
});

describe('clientBookingLink', () => {
    // Адрес ссылки берётся из окружения, а не из воздуха: publicBaseUrl читает
    // AUTH_URL, затем NEXTAUTH_URL и только потом падает на cmpas.ru. Пока
    // тест не задавал эти переменные сам, он проверял не правило, а машину, на
    // которой запущен: у разработчика они пусты — зелено, в шаге выкладки
    // стоит AUTH_URL=http://localhost:3000 (он нужен сборке Next.js) — красно.
    // Поэтому окружение здесь задаётся явно в каждом случае.
    afterEach(() => {
        vi.unstubAllEnvs();
    });

    function withoutBaseUrlEnv() {
        vi.stubEnv('AUTH_URL', undefined);
        vi.stubEnv('NEXTAUTH_URL', undefined);
    }

    it('без AUTH_URL и NEXTAUTH_URL ссылка ведёт на боевой адрес, а не на localhost', () => {
        withoutBaseUrlEnv();
        expect(clientBookingLink('psy-1', '')).toBe('https://cmpas.ru/bot/book/psy-1');
    });

    it('заданный AUTH_URL сильнее запасного адреса', () => {
        vi.stubEnv('AUTH_URL', 'https://stage.example.org');
        expect(clientBookingLink('psy-1', '')).toBe('https://stage.example.org/bot/book/psy-1');
    });

    it('NEXTAUTH_URL используется, когда AUTH_URL не задан', () => {
        vi.stubEnv('AUTH_URL', undefined);
        vi.stubEnv('NEXTAUTH_URL', 'https://old.example.org');
        expect(clientBookingLink('psy-1', '')).toBe('https://old.example.org/bot/book/psy-1');
    });

    it('без clientId параметра c в ссылке нет вовсе', () => {
        withoutBaseUrlEnv();
        expect(new URL(clientBookingLink('psy-1', '')).searchParams.has('c')).toBe(false);
    });

    it('signs the clientId into a token that resolves back correctly', () => {
        const link = clientBookingLink('psy-1', 'client-123');
        const url = new URL(link);
        expect(url.pathname).toBe('/bot/book/psy-1');
        const token = url.searchParams.get('c');
        expect(token).toMatch(/^st1_/);
        expect(resolvePersonalClientToken(token)).toEqual({ clientId: 'client-123', legacy: false });
    });

    // §5.1 (O-260829): an explicit `base` (a resolved /u/<slug> URL) overrides
    // the default /bot/book/<id> base — callers that have a human-readable
    // address use it, everyone else keeps the id-based link unchanged.
    it('an explicit base overrides the default /bot/book/<id> URL', () => {
        withoutBaseUrlEnv();
        expect(clientBookingLink('psy-1', '', 'https://cmpas.ru/u/anna-volkova'))
            .toBe('https://cmpas.ru/u/anna-volkova');
    });

    it('the c= token still appends correctly onto an explicit base', () => {
        withoutBaseUrlEnv();
        const link = clientBookingLink('psy-1', 'client-123', 'https://cmpas.ru/u/anna-volkova');
        const url = new URL(link);
        expect(url.pathname).toBe('/u/anna-volkova');
        expect(resolvePersonalClientToken(url.searchParams.get('c'))).toEqual({ clientId: 'client-123', legacy: false });
    });
});
