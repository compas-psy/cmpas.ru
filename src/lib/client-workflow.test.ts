import { afterEach, describe, expect, it, vi } from 'vitest';

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
});
