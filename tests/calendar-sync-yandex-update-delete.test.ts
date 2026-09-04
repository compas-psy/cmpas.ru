// Task 12 (founder correction round 3, item 11): update/delete a Yandex
// event by its known externalEventId. Update preserves the event's own
// UID (and RECURRENCE-ID for a recurring occurrence) — never PRAKTIKA's
// own convention — since it may be a foreign, psychologist-authored event.
// Delete closes the long-standing "Yandex delete is a no-op" gap.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const calendarIntegrationFindUnique = vi.fn();
const calendarIntegrationUpdate = vi.fn();
vi.mock('@/lib/db', () => ({
    db: {
        calendarIntegration: {
            findUnique: (...args: unknown[]) => calendarIntegrationFindUnique(...args),
            update: (...args: unknown[]) => calendarIntegrationUpdate(...args),
        },
    },
}));

const login = vi.fn().mockResolvedValue(undefined);
const fetchCalendars = vi.fn();
const fetchCalendarObjects = vi.fn();
const updateCalendarObject = vi.fn().mockResolvedValue({ ok: true });
const deleteCalendarObject = vi.fn().mockResolvedValue({ ok: true });
vi.mock('tsdav', () => ({
    DAVClient: vi.fn().mockImplementation(function DAVClient(this: any) {
        this.login = login;
        this.fetchCalendars = fetchCalendars;
        this.fetchCalendarObjects = (...args: unknown[]) => fetchCalendarObjects(...args);
        this.updateCalendarObject = (...args: unknown[]) => updateCalendarObject(...args);
        this.deleteCalendarObject = (...args: unknown[]) => deleteCalendarObject(...args);
    }),
}));

function integrationRow() {
    return { id: 'integration-1', caldavLogin: 'user@yandex.ru', caldavPassword: 'secret', calendarId: 'https://caldav.yandex.ru/cal/primary' };
}
function vevent(body: string) {
    return `BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\n${body}\r\nEND:VEVENT\r\nEND:VCALENDAR`;
}

const session = {
    id: 'session-1', date: new Date('2026-09-07T00:00:00Z'), time: '11:00', endTime: '11:50', duration: 50,
    type: 'individual', format: 'online', notes: null, client: { name: 'Иван' },
};

beforeEach(() => {
    vi.clearAllMocks();
    calendarIntegrationFindUnique.mockResolvedValue(integrationRow());
    fetchCalendars.mockResolvedValue([{ url: integrationRow().calendarId, displayName: 'Основной' }]);
});

describe('updateYandexCalendarEvent', () => {
    it('finds the existing object by identity and PUTs new content, preserving its foreign UID', async () => {
        fetchCalendarObjects.mockResolvedValue([
            { url: 'https://caldav.yandex.ru/cal/primary/abc.ics', etag: '"1"', data: vevent('UID:foreign-uid@yandex.ru\r\nDTSTART:20260907T090000Z\r\nDTEND:20260907T095000Z\r\nSUMMARY:Old') },
        ]);

        const { updateYandexCalendarEvent } = await import('../src/lib/calendar/yandex');
        const result = await updateYandexCalendarEvent('integration-1', 'foreign-uid@yandex.ru', session);

        expect(result.success).toBe(true);
        const [{ calendarObject }] = updateCalendarObject.mock.calls[0];
        expect(calendarObject.url).toBe('https://caldav.yandex.ru/cal/primary/abc.ics');
        expect(calendarObject.data).toContain('UID:foreign-uid@yandex.ru');
    });

    it('preserves RECURRENCE-ID for a recurring occurrence', async () => {
        fetchCalendarObjects.mockResolvedValue([
            { url: 'https://caldav.yandex.ru/cal/primary/series.ics', etag: '"1"', data: vevent('UID:series-uid@yandex.ru\r\nRECURRENCE-ID:20260907T090000Z\r\nDTSTART:20260907T090000Z\r\nDTEND:20260907T095000Z\r\nSUMMARY:Old') },
        ]);

        const { updateYandexCalendarEvent } = await import('../src/lib/calendar/yandex');
        await updateYandexCalendarEvent('integration-1', 'series-uid@yandex.ru::20260907T090000Z', session);

        const [{ calendarObject }] = updateCalendarObject.mock.calls[0];
        expect(calendarObject.data).toContain('RECURRENCE-ID:20260907T090000Z');
    });

    it('returns an error when the event cannot be found by identity', async () => {
        fetchCalendarObjects.mockResolvedValue([]);
        const { updateYandexCalendarEvent } = await import('../src/lib/calendar/yandex');
        const result = await updateYandexCalendarEvent('integration-1', 'missing@yandex.ru', session);
        expect(result.success).toBe(false);
        expect(updateCalendarObject).not.toHaveBeenCalled();
    });
});

describe('deleteYandexCalendarEventById', () => {
    it('finds the object and deletes it — real delete, no longer a no-op', async () => {
        fetchCalendarObjects.mockResolvedValue([
            { url: 'https://caldav.yandex.ru/cal/primary/abc.ics', etag: '"1"', data: vevent('UID:compas-session-session-1@cmpas.ru\r\nDTSTART:20260907T090000Z\r\nDTEND:20260907T095000Z\r\nSUMMARY:Own') },
        ]);

        const { deleteYandexCalendarEventById } = await import('../src/lib/calendar/yandex');
        const result = await deleteYandexCalendarEventById('integration-1', 'compas-session-session-1@cmpas.ru');

        expect(result.success).toBe(true);
        expect(deleteCalendarObject).toHaveBeenCalledWith({ calendarObject: { url: 'https://caldav.yandex.ru/cal/primary/abc.ics', etag: '"1"' } });
    });

    it('treats "not found" as success', async () => {
        fetchCalendarObjects.mockResolvedValue([]);
        const { deleteYandexCalendarEventById } = await import('../src/lib/calendar/yandex');
        const result = await deleteYandexCalendarEventById('integration-1', 'gone@yandex.ru');
        expect(result.success).toBe(true);
        expect(deleteCalendarObject).not.toHaveBeenCalled();
    });
});
