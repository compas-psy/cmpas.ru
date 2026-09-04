// Task 12 (founder correction round 3, item 11): the sync adapter is
// link-aware — a reschedule (autoSyncSessionToCalendars on an already
// linked session) updates the SAME external event in place, never
// delete+recreate. A session with no link yet still gets created+linked
// (sourceRole='synced'). excludeIntegrationId keeps commit.ts's post-import
// sync-out from reflecting a duplicate event back into the source calendar.
// autoDeleteSessionFromCalendars uses the link's real externalEventId for
// both providers, then removes the link rows; a session with no link at all
// (pre-Task-12 data) falls back to the legacy Google search-by-property delete.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const psychologistSettingsFindUnique = vi.fn();
const calendarIntegrationFindMany = vi.fn();
const calendarSessionLinkFindFirst = vi.fn();
const calendarSessionLinkFindMany = vi.fn();
const calendarSessionLinkCreate = vi.fn();
const calendarSessionLinkDeleteMany = vi.fn();

vi.mock('@/lib/db', () => ({
    db: {
        psychologistSettings: { findUnique: (...args: unknown[]) => psychologistSettingsFindUnique(...args) },
        calendarIntegration: { findMany: (...args: unknown[]) => calendarIntegrationFindMany(...args) },
        calendarSessionLink: {
            findFirst: (...args: unknown[]) => calendarSessionLinkFindFirst(...args),
            findMany: (...args: unknown[]) => calendarSessionLinkFindMany(...args),
            create: (...args: unknown[]) => calendarSessionLinkCreate(...args),
            deleteMany: (...args: unknown[]) => calendarSessionLinkDeleteMany(...args),
        },
    },
}));

const createGoogleCalendarEvent = vi.fn();
const updateGoogleCalendarEvent = vi.fn();
const deleteGoogleCalendarEventById = vi.fn();
const deleteGoogleCalendarEvent = vi.fn();
vi.mock('@/lib/calendar/google', () => ({
    createGoogleCalendarEvent: (...args: unknown[]) => createGoogleCalendarEvent(...args),
    updateGoogleCalendarEvent: (...args: unknown[]) => updateGoogleCalendarEvent(...args),
    deleteGoogleCalendarEventById: (...args: unknown[]) => deleteGoogleCalendarEventById(...args),
    deleteGoogleCalendarEvent: (...args: unknown[]) => deleteGoogleCalendarEvent(...args),
}));

const pushSessionToYandex = vi.fn();
const updateYandexCalendarEvent = vi.fn();
const deleteYandexCalendarEventById = vi.fn();
vi.mock('@/lib/calendar/yandex', () => ({
    pushSessionToYandex: (...args: unknown[]) => pushSessionToYandex(...args),
    updateYandexCalendarEvent: (...args: unknown[]) => updateYandexCalendarEvent(...args),
    deleteYandexCalendarEventById: (...args: unknown[]) => deleteYandexCalendarEventById(...args),
}));

const session = { id: 'session-1', date: new Date('2026-09-07T00:00:00Z'), time: '10:00', endTime: '10:50', duration: 50, type: 'individual', format: 'online', notes: null, client: { name: 'Иван' } };

beforeEach(() => {
    vi.clearAllMocks();
    psychologistSettingsFindUnique.mockResolvedValue({ autoSync: true });
});

describe('autoSyncSessionToCalendars (Task 12, link-aware)', () => {
    it('an already-linked session gets its event updated in place — never a second create', async () => {
        calendarIntegrationFindMany.mockResolvedValue([{ id: 'integration-1', provider: 'google', accessToken: 'tok', isActive: true }]);
        calendarSessionLinkFindFirst.mockResolvedValue({ id: 'link-1', externalEventId: 'evt-existing' });

        const { autoSyncSessionToCalendars } = await import('../src/lib/calendar/auto-sync');
        await autoSyncSessionToCalendars('psy-1', session);

        expect(updateGoogleCalendarEvent).toHaveBeenCalledWith('integration-1', 'evt-existing', session);
        expect(createGoogleCalendarEvent).not.toHaveBeenCalled();
    });

    it('same, for a linked Yandex integration', async () => {
        calendarIntegrationFindMany.mockResolvedValue([{ id: 'integration-2', provider: 'yandex', caldavLogin: 'x', isActive: true }]);
        calendarSessionLinkFindFirst.mockResolvedValue({ id: 'link-1', externalEventId: 'compas-session-session-1@cmpas.ru' });

        const { autoSyncSessionToCalendars } = await import('../src/lib/calendar/auto-sync');
        await autoSyncSessionToCalendars('psy-1', session);

        expect(updateYandexCalendarEvent).toHaveBeenCalledWith('integration-2', 'compas-session-session-1@cmpas.ru', session);
        expect(pushSessionToYandex).not.toHaveBeenCalled();
    });

    it('a session with no link yet gets a new event created and a new sourceRole=synced link (Google)', async () => {
        calendarIntegrationFindMany.mockResolvedValue([{ id: 'integration-1', provider: 'google', accessToken: 'tok', isActive: true }]);
        calendarSessionLinkFindFirst.mockResolvedValue(null);
        createGoogleCalendarEvent.mockResolvedValue({ success: true, eventId: 'evt-new' });

        const { autoSyncSessionToCalendars } = await import('../src/lib/calendar/auto-sync');
        await autoSyncSessionToCalendars('psy-1', session);

        expect(createGoogleCalendarEvent).toHaveBeenCalled();
        expect(calendarSessionLinkCreate).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({ integrationId: 'integration-1', sessionId: 'session-1', externalEventId: 'evt-new', sourceRole: 'synced' }),
        }));
    });

    it('a session with no link yet on Yandex gets its deterministic own-session UID linked as sourceRole=synced', async () => {
        calendarIntegrationFindMany.mockResolvedValue([{ id: 'integration-2', provider: 'yandex', caldavLogin: 'x', isActive: true }]);
        calendarSessionLinkFindFirst.mockResolvedValue(null);
        pushSessionToYandex.mockResolvedValue({ success: true, eventId: 'compas-session-session-1@cmpas.ru' });

        const { autoSyncSessionToCalendars } = await import('../src/lib/calendar/auto-sync');
        await autoSyncSessionToCalendars('psy-1', session);

        expect(calendarSessionLinkCreate).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({ integrationId: 'integration-2', externalEventId: 'compas-session-session-1@cmpas.ru', sourceRole: 'synced' }),
        }));
    });

    it('excludeIntegrationId skips the source integration an import came from entirely', async () => {
        calendarIntegrationFindMany.mockResolvedValue([{ id: 'integration-source', provider: 'google', accessToken: 'tok', isActive: true }]);

        const { autoSyncSessionToCalendars } = await import('../src/lib/calendar/auto-sync');
        await autoSyncSessionToCalendars('psy-1', session, { excludeIntegrationId: 'integration-source' });

        expect(calendarSessionLinkFindFirst).not.toHaveBeenCalled();
        expect(createGoogleCalendarEvent).not.toHaveBeenCalled();
        expect(updateGoogleCalendarEvent).not.toHaveBeenCalled();
    });

    it('does nothing at all when autoSync is disabled', async () => {
        psychologistSettingsFindUnique.mockResolvedValue({ autoSync: false });
        calendarIntegrationFindMany.mockResolvedValue([{ id: 'integration-1', provider: 'google', accessToken: 'tok', isActive: true }]);

        const { autoSyncSessionToCalendars } = await import('../src/lib/calendar/auto-sync');
        await autoSyncSessionToCalendars('psy-1', session);

        expect(calendarIntegrationFindMany).not.toHaveBeenCalled();
    });
});

describe('autoDeleteSessionFromCalendars (Task 12, real delete for both providers)', () => {
    it('deletes every linked event by its real externalEventId, then removes the link rows', async () => {
        calendarSessionLinkFindMany.mockResolvedValue([
            { id: 'link-1', integrationId: 'integration-1', externalEventId: 'evt-1', integration: { provider: 'google', accessToken: 'tok' } },
            { id: 'link-2', integrationId: 'integration-2', externalEventId: 'compas-session-session-1@cmpas.ru', integration: { provider: 'yandex', caldavLogin: 'x' } },
        ]);
        deleteGoogleCalendarEventById.mockResolvedValue({ success: true });
        deleteYandexCalendarEventById.mockResolvedValue({ success: true });

        const { autoDeleteSessionFromCalendars } = await import('../src/lib/calendar/auto-sync');
        await autoDeleteSessionFromCalendars('psy-1', 'session-1');

        expect(deleteGoogleCalendarEventById).toHaveBeenCalledWith('integration-1', 'evt-1');
        expect(deleteYandexCalendarEventById).toHaveBeenCalledWith('integration-2', 'compas-session-session-1@cmpas.ru');
        expect(calendarSessionLinkDeleteMany).toHaveBeenCalledWith({ where: { sessionId: 'session-1', psychologistId: 'psy-1' } });
    });

    it('a session with no links at all falls back to the legacy Google search-by-property delete', async () => {
        calendarSessionLinkFindMany.mockResolvedValue([]);
        calendarIntegrationFindMany.mockResolvedValue([{ id: 'integration-1', provider: 'google', accessToken: 'tok', isActive: true }]);

        const { autoDeleteSessionFromCalendars } = await import('../src/lib/calendar/auto-sync');
        await autoDeleteSessionFromCalendars('psy-1', 'session-legacy');

        expect(deleteGoogleCalendarEvent).toHaveBeenCalledWith('integration-1', 'session-legacy');
        expect(calendarSessionLinkDeleteMany).not.toHaveBeenCalled();
    });

    it('does nothing when autoSync is disabled', async () => {
        psychologistSettingsFindUnique.mockResolvedValue({ autoSync: false });
        const { autoDeleteSessionFromCalendars } = await import('../src/lib/calendar/auto-sync');
        await autoDeleteSessionFromCalendars('psy-1', 'session-1');
        expect(calendarSessionLinkFindMany).not.toHaveBeenCalled();
    });
});
