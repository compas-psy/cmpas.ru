// Task 12 (founder correction round 3, item 11): update/delete a Google
// event by its known externalEventId — the identity-based counterpart to
// create, used so a reschedule updates the SAME linked event in place.

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

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

beforeEach(() => {
    vi.clearAllMocks();
    calendarIntegrationFindUnique.mockResolvedValue({ id: 'integration-1', calendarId: 'primary', accessToken: 'token', tokenExpiry: new Date(Date.now() + 3600000) });
});

const session = {
    id: 'session-1', date: new Date('2026-09-07T00:00:00Z'), time: '10:00', endTime: '10:50', duration: 50,
    type: 'individual', format: 'online', notes: null, client: { name: 'Иван' },
};

describe('updateGoogleCalendarEvent', () => {
    it('PATCHes the SAME event id — never creates a new one', async () => {
        fetchMock.mockResolvedValue({ ok: true, json: async () => ({}), text: async () => '' });
        const { updateGoogleCalendarEvent } = await import('../src/lib/calendar/google');

        const result = await updateGoogleCalendarEvent('integration-1', 'evt-existing', session);

        expect(result.success).toBe(true);
        const [url, init] = fetchMock.mock.calls[0];
        expect(url).toContain('/events/evt-existing');
        expect(init.method).toBe('PATCH');
    });
});

describe('deleteGoogleCalendarEventById', () => {
    it('DELETEs the exact known event id', async () => {
        fetchMock.mockResolvedValue({ ok: true, status: 200, text: async () => '' });
        const { deleteGoogleCalendarEventById } = await import('../src/lib/calendar/google');

        const result = await deleteGoogleCalendarEventById('integration-1', 'evt-existing');

        expect(result.success).toBe(true);
        const [url, init] = fetchMock.mock.calls[0];
        expect(url).toContain('/events/evt-existing');
        expect(init.method).toBe('DELETE');
    });

    it('treats a 404 (already gone) as success', async () => {
        fetchMock.mockResolvedValue({ ok: false, status: 404, text: async () => 'Not Found' });
        const { deleteGoogleCalendarEventById } = await import('../src/lib/calendar/google');

        const result = await deleteGoogleCalendarEventById('integration-1', 'evt-gone');
        expect(result.success).toBe(true);
    });
});
