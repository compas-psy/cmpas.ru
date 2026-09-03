// Task 10: fetchYandexCalendarEvents must return NormalizedCalendarEvent[] —
// before this, it never read back the iCal UID at all, so it had NO way to
// recognize a Yandex event PRAKTIKA itself created and pushed
// (pushSessionToYandex stamps `UID:compas-session-{id}@cmpas.ru`). A
// psychologist's own already-booked session — or a stale event a
// reschedule left behind, since Yandex delete is still a no-op — counted as
// "external busy" against their own future availability, forever. This
// proves the fix: own-session UID detection, isAllDay, floating-time
// handling, and timezone-correct date/time resolution.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const calendarIntegrationFindUnique = vi.fn();
vi.mock('@/lib/db', () => ({
    db: {
        calendarIntegration: {
            findUnique: (...args: unknown[]) => calendarIntegrationFindUnique(...args),
        },
    },
}));

const fetchCalendars = vi.fn();
const fetchCalendarObjects = vi.fn();
const login = vi.fn().mockResolvedValue(undefined);

vi.mock('tsdav', () => ({
    DAVClient: vi.fn().mockImplementation(function DAVClient(this: any) {
        this.login = login;
        this.fetchCalendars = fetchCalendars;
        this.fetchCalendarObjects = (...args: unknown[]) => fetchCalendarObjects(...args);
    }),
}));

function integrationRow() {
    return {
        id: 'integration-1',
        caldavLogin: 'user@yandex.ru',
        caldavPassword: 'secret',
        calendarId: 'https://caldav.yandex.ru/cal/primary',
    };
}

function vevent(body: string) {
    return `BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\n${body}\r\nEND:VEVENT\r\nEND:VCALENDAR`;
}

describe('fetchYandexCalendarEvents (Task 10 normalization)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        calendarIntegrationFindUnique.mockResolvedValue(integrationRow());
        fetchCalendars.mockResolvedValue([{ url: integrationRow().calendarId, displayName: 'Основной' }]);
    });

    it('excludes cancelled and transparent (free) events', async () => {
        fetchCalendarObjects.mockResolvedValue([
            { data: vevent('DTSTART:20260907T090000Z\r\nDTEND:20260907T095000Z\r\nSUMMARY:Cancelled\r\nSTATUS:CANCELLED') },
            { data: vevent('DTSTART:20260907T110000Z\r\nDTEND:20260907T115000Z\r\nSUMMARY:Free\r\nTRANSP:TRANSPARENT') },
        ]);

        const { fetchYandexCalendarEvents } = await import('../yandex');
        const result = await fetchYandexCalendarEvents('integration-1', new Date(), new Date());

        expect(result.success).toBe(true);
        expect(result.events).toHaveLength(0);
    });

    it('excludes PRAKTIKA-synced (own) events by default via their UID, and includes them when includeCompasEvents is true', async () => {
        fetchCalendarObjects.mockResolvedValue([
            { data: vevent('UID:compas-session-session-42@cmpas.ru\r\nDTSTART:20260907T090000Z\r\nDTEND:20260907T095000Z\r\nSUMMARY:Индивидуальная сессия — Клиент') },
        ]);

        const { fetchYandexCalendarEvents } = await import('../yandex');

        const excluded = await fetchYandexCalendarEvents('integration-1', new Date(), new Date());
        expect(excluded.events).toHaveLength(0);

        const included = await fetchYandexCalendarEvents('integration-1', new Date(), new Date(), { includeCompasEvents: true });
        expect(included.events).toHaveLength(1);
        expect(included.events![0].isOwnSession).toBe(true);
        expect(included.events![0].ownSessionId).toBe('session-42');
        expect(included.events![0].externalId).toBe('compas-session-session-42@cmpas.ru');
    });

    it('a real external event (not ours) resolves date/time against the given timezone and exposes its UID as externalId', async () => {
        // 21:00 UTC is 00:00 the next day in Europe/Moscow (UTC+3).
        fetchCalendarObjects.mockResolvedValue([
            { data: vevent('UID:some-external-uid@yandex.ru\r\nDTSTART:20260907T210000Z\r\nDTEND:20260907T215000Z\r\nSUMMARY:Клиент Х') },
        ]);

        const { fetchYandexCalendarEvents } = await import('../yandex');
        const result = await fetchYandexCalendarEvents('integration-1', new Date(), new Date(), { timezone: 'Europe/Moscow' });

        expect(result.events).toHaveLength(1);
        const event = result.events![0];
        expect(event.provider).toBe('yandex');
        expect(event.externalId).toBe('some-external-uid@yandex.ru');
        expect(event.isOwnSession).toBe(false);
        expect(event.ownSessionId).toBeNull();
        expect(event.date).toBe('2026-09-08');
        expect(event.startTime).toBe('00:00');
    });

    it('a floating (no-Z) local time uses its literal wall-clock digits, never converted by timezone', async () => {
        fetchCalendarObjects.mockResolvedValue([
            { data: vevent('UID:floating-uid@yandex.ru\r\nDTSTART:20260907T093000\r\nDTEND:20260907T102000\r\nSUMMARY:Floating') },
        ]);

        const { fetchYandexCalendarEvents } = await import('../yandex');
        const result = await fetchYandexCalendarEvents('integration-1', new Date(), new Date(), { timezone: 'America/New_York' });

        expect(result.events).toHaveLength(1);
        expect(result.events![0].date).toBe('2026-09-07');
        expect(result.events![0].startTime).toBe('09:30');
        expect(result.events![0].endTime).toBe('10:20');
    });

    it('flags an all-day event (8-digit DTSTART, no explicit DTEND)', async () => {
        fetchCalendarObjects.mockResolvedValue([
            { data: vevent('UID:allday-uid@yandex.ru\r\nDTSTART:20260910\r\nSUMMARY:Отпуск') },
        ]);

        const { fetchYandexCalendarEvents } = await import('../yandex');
        const result = await fetchYandexCalendarEvents('integration-1', new Date(), new Date());

        expect(result.events).toHaveLength(1);
        expect(result.events![0].isAllDay).toBe(true);
    });
});
