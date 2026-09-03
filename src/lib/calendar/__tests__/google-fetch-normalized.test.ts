// Task 10: fetchGoogleCalendarEvents must return NormalizedCalendarEvent[] —
// a stable externalId, isAllDay, isOwnSession/ownSessionId (loop-back
// detection via extendedProperties.private.compasSessionId), and date/time
// resolved against the given timezone (not the server's OS timezone).

import { describe, it, expect, vi, beforeEach } from 'vitest';

const calendarIntegrationFindUnique = vi.fn();
vi.mock('@/lib/db', () => ({
    db: {
        calendarIntegration: {
            findUnique: (...args: unknown[]) => calendarIntegrationFindUnique(...args),
        },
    },
}));

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

function integrationRow() {
    return {
        id: 'integration-1',
        calendarId: 'primary',
        accessToken: 'valid-token',
        refreshToken: null,
        tokenExpiry: new Date(Date.now() + 60 * 60 * 1000), // not expiring soon
    };
}

function googleApiResponse(items: any[]) {
    return { ok: true, json: async () => ({ items }), text: async () => '' };
}

describe('fetchGoogleCalendarEvents (Task 10 normalization)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        calendarIntegrationFindUnique.mockResolvedValue(integrationRow());
    });

    it('excludes cancelled events', async () => {
        fetchMock.mockResolvedValueOnce(googleApiResponse([
            { id: 'evt-cancelled', status: 'cancelled', start: { dateTime: '2026-09-07T09:00:00Z' }, end: { dateTime: '2026-09-07T10:00:00Z' }, summary: 'Nope' },
        ]));

        const { fetchGoogleCalendarEvents } = await import('../google');
        const result = await fetchGoogleCalendarEvents('integration-1', new Date(), new Date());

        expect(result.success).toBe(true);
        expect(result.events).toHaveLength(0);
    });

    it('excludes PRAKTIKA-synced (own) events by default, and includes them when includeCompasEvents is true', async () => {
        fetchMock.mockResolvedValue(googleApiResponse([
            {
                id: 'evt-own', status: 'confirmed',
                start: { dateTime: '2026-09-07T09:00:00Z' }, end: { dateTime: '2026-09-07T09:50:00Z' },
                summary: 'Индивидуальная сессия — Клиент',
                extendedProperties: { private: { compasSessionId: 'session-42' } },
            },
        ]));

        const { fetchGoogleCalendarEvents } = await import('../google');

        const excluded = await fetchGoogleCalendarEvents('integration-1', new Date(), new Date());
        expect(excluded.events).toHaveLength(0);

        const included = await fetchGoogleCalendarEvents('integration-1', new Date(), new Date(), { includeCompasEvents: true });
        expect(included.events).toHaveLength(1);
        expect(included.events![0].isOwnSession).toBe(true);
        expect(included.events![0].ownSessionId).toBe('session-42');
    });

    it('resolves date/time against the given timezone, not the server local time, and exposes a stable externalId', async () => {
        // 21:00 UTC is 00:00 the next day in Europe/Moscow (UTC+3).
        fetchMock.mockResolvedValueOnce(googleApiResponse([
            { id: 'evt-real', status: 'confirmed', start: { dateTime: '2026-09-07T21:00:00Z' }, end: { dateTime: '2026-09-07T21:50:00Z' }, summary: 'Клиент Х' },
        ]));

        const { fetchGoogleCalendarEvents } = await import('../google');
        const result = await fetchGoogleCalendarEvents('integration-1', new Date(), new Date(), { timezone: 'Europe/Moscow' });

        expect(result.events).toHaveLength(1);
        const event = result.events![0];
        expect(event.externalId).toBe('evt-real');
        expect(event.provider).toBe('google');
        expect(event.isOwnSession).toBe(false);
        expect(event.ownSessionId).toBeNull();
        expect(event.isAllDay).toBe(false);
        expect(event.date).toBe('2026-09-08');
        expect(event.startTime).toBe('00:00');
    });

    it('flags all-day events', async () => {
        fetchMock.mockResolvedValueOnce(googleApiResponse([
            { id: 'evt-allday', status: 'confirmed', start: { date: '2026-09-10' }, end: { date: '2026-09-11' }, summary: 'Отпуск' },
        ]));

        const { fetchGoogleCalendarEvents } = await import('../google');
        const result = await fetchGoogleCalendarEvents('integration-1', new Date(), new Date());

        expect(result.events).toHaveLength(1);
        expect(result.events![0].isAllDay).toBe(true);
    });
});
