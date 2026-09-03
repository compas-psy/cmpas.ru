// Task 11 (founder correction) — the preview route now returns a real
// review model: every event lands in classification/reviewState (never
// silently dropped), and a name-only match is only ever `suggestedClientId`,
// never an auto-resolved `resolvedClientId` — see src/lib/clients/match.ts
// and src/lib/practice/migration/classify.ts.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const auth = vi.fn();
vi.mock('@/auth', () => ({ auth: (...args: unknown[]) => auth(...args) }));

const psychologistSettingsFindUnique = vi.fn();
const calendarIntegrationFindMany = vi.fn();
const diaryClientFindMany = vi.fn();
const diarySessionFindMany = vi.fn();
vi.mock('@/lib/db', () => ({
    db: {
        psychologistSettings: { findUnique: (...args: unknown[]) => psychologistSettingsFindUnique(...args) },
        calendarIntegration: { findMany: (...args: unknown[]) => calendarIntegrationFindMany(...args) },
        diaryClient: { findMany: (...args: unknown[]) => diaryClientFindMany(...args) },
        diarySession: { findMany: (...args: unknown[]) => diarySessionFindMany(...args) },
    },
}));

const fetchGoogleCalendarEvents = vi.fn();
vi.mock('@/lib/calendar/google', () => ({
    fetchGoogleCalendarEvents: (...args: unknown[]) => fetchGoogleCalendarEvents(...args),
}));
const fetchYandexCalendarEvents = vi.fn();
vi.mock('@/lib/calendar/yandex', () => ({
    fetchYandexCalendarEvents: (...args: unknown[]) => fetchYandexCalendarEvents(...args),
}));

function googleEvent(overrides: Record<string, unknown> = {}) {
    return {
        provider: 'google', integrationId: 'integration-1', externalEventId: 'evt-1', externalSeriesId: null,
        summary: 'Сессия — Иван Иванов',
        start: new Date('2026-09-07T06:00:00Z'), end: new Date('2026-09-07T06:50:00Z'),
        date: '2026-09-07', startTime: '09:00', endTime: '09:50',
        allDay: false, isOwnSession: false, ownSessionId: null,
        ...overrides,
    };
}

describe('GET /api/diary/calendar/import/preview (Task 11)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        auth.mockResolvedValue({ user: { id: 'psy-1' } });
        diaryClientFindMany.mockResolvedValue([]);
        diarySessionFindMany.mockResolvedValue([]);
        fetchGoogleCalendarEvents.mockResolvedValue({ success: true, events: [] });
        fetchYandexCalendarEvents.mockResolvedValue({ success: true, events: [] });
    });

    it('passes the practice timezone through to both fetchers — never derives time from the server local clock', async () => {
        psychologistSettingsFindUnique.mockResolvedValue({ timezone: 'Asia/Yekaterinburg' });
        calendarIntegrationFindMany.mockResolvedValue([
            { id: 'integration-1', provider: 'google' },
            { id: 'integration-2', provider: 'yandex' },
        ]);

        const { GET } = await import('../src/app/api/diary/calendar/import/preview/route');
        await GET();

        expect(fetchGoogleCalendarEvents).toHaveBeenCalledWith(
            'integration-1', expect.any(Date), expect.any(Date),
            expect.objectContaining({ timezone: 'Asia/Yekaterinburg' }),
        );
        expect(fetchYandexCalendarEvents).toHaveBeenCalledWith(
            'integration-2', expect.any(Date), expect.any(Date),
            expect.objectContaining({ timezone: 'Asia/Yekaterinburg' }),
        );
    });

    it('defaults to Europe/Moscow when the psychologist has no timezone setting', async () => {
        psychologistSettingsFindUnique.mockResolvedValue(null);
        calendarIntegrationFindMany.mockResolvedValue([{ id: 'integration-1', provider: 'google' }]);

        const { GET } = await import('../src/app/api/diary/calendar/import/preview/route');
        await GET();

        expect(fetchGoogleCalendarEvents).toHaveBeenCalledWith(
            'integration-1', expect.any(Date), expect.any(Date),
            expect.objectContaining({ timezone: 'Europe/Moscow' }),
        );
    });

    it('scans the psychologist-local-today -> +180 day window, not a 60-day-from-now default', async () => {
        psychologistSettingsFindUnique.mockResolvedValue({ timezone: 'Europe/Moscow' });
        calendarIntegrationFindMany.mockResolvedValue([{ id: 'integration-1', provider: 'google' }]);

        const { GET } = await import('../src/app/api/diary/calendar/import/preview/route');
        await GET();

        const [, start, end] = fetchGoogleCalendarEvents.mock.calls[0];
        const days = Math.round((end.getTime() - start.getTime()) / 86400000);
        expect(days).toBeGreaterThan(170); // ~180 days, not ~60
    });

    it('classifies a real client-name candidate as session/review, with the stable provider-id', async () => {
        psychologistSettingsFindUnique.mockResolvedValue({ timezone: 'Europe/Moscow' });
        calendarIntegrationFindMany.mockResolvedValue([{ id: 'integration-1', provider: 'google' }]);
        fetchGoogleCalendarEvents.mockResolvedValue({ success: true, events: [googleEvent()] });

        const { GET } = await import('../src/app/api/diary/calendar/import/preview/route');
        const res = await GET();
        const body = await res.json();

        expect(body.items).toHaveLength(1);
        expect(body.items[0]).toMatchObject({
            proposedClientName: 'Иван Иванов', date: '2026-09-07', startTime: '09:00', endTime: '09:50',
            classification: 'session', reviewState: 'review',
        });
        expect(body.items[0].id).toBe('google:integration-1:evt-1');
        expect(body.counts).toEqual({ ready: 0, review: 1, personal: 0, skipped: 0 });
    });

    it('also scans Yandex integrations, not just Google', async () => {
        psychologistSettingsFindUnique.mockResolvedValue({ timezone: 'Europe/Moscow' });
        calendarIntegrationFindMany.mockResolvedValue([{ id: 'integration-2', provider: 'yandex' }]);
        fetchYandexCalendarEvents.mockResolvedValue({
            success: true,
            events: [googleEvent({ provider: 'yandex', integrationId: 'integration-2', externalEventId: 'evt-yandex' })],
        });

        const { GET } = await import('../src/app/api/diary/calendar/import/preview/route');
        const res = await GET();
        const body = await res.json();

        expect(body.items).toHaveLength(1);
        expect(body.items[0].id).toBe('yandex:integration-2:evt-yandex');
    });

    it('all-day events classify as personal, they are not dropped from the response', async () => {
        psychologistSettingsFindUnique.mockResolvedValue({ timezone: 'Europe/Moscow' });
        calendarIntegrationFindMany.mockResolvedValue([{ id: 'integration-1', provider: 'google' }]);
        fetchGoogleCalendarEvents.mockResolvedValue({
            success: true,
            events: [googleEvent({ externalEventId: 'evt-allday', summary: 'Отпуск', allDay: true })],
        });

        const { GET } = await import('../src/app/api/diary/calendar/import/preview/route');
        const res = await GET();
        const body = await res.json();

        expect(body.items).toHaveLength(1);
        expect(body.items[0].classification).toBe('personal');
        expect(body.counts.personal).toBe(1);
    });

    it('a summary extract-name.ts cannot turn into a client name still appears, classified uncertain/review', async () => {
        psychologistSettingsFindUnique.mockResolvedValue({ timezone: 'Europe/Moscow' });
        calendarIntegrationFindMany.mockResolvedValue([{ id: 'integration-1', provider: 'google' }]);
        fetchGoogleCalendarEvents.mockResolvedValue({
            success: true,
            events: [googleEvent({ externalEventId: 'evt-unknown', summary: 'xyz 123' })],
        });

        const { GET } = await import('../src/app/api/diary/calendar/import/preview/route');
        const res = await GET();
        const body = await res.json();

        expect(body.items).toHaveLength(1);
        expect(body.items[0].classification).toBe('uncertain');
        expect(body.items[0].reviewState).toBe('review');
    });

    it('a recognized personal keyword ("Обед") classifies as personal, not uncertain', async () => {
        psychologistSettingsFindUnique.mockResolvedValue({ timezone: 'Europe/Moscow' });
        calendarIntegrationFindMany.mockResolvedValue([{ id: 'integration-1', provider: 'google' }]);
        fetchGoogleCalendarEvents.mockResolvedValue({
            success: true,
            events: [googleEvent({ externalEventId: 'evt-lunch', summary: 'Обед' })],
        });

        const { GET } = await import('../src/app/api/diary/calendar/import/preview/route');
        const res = await GET();
        const body = await res.json();

        expect(body.items[0].classification).toBe('personal');
    });

    it('a name-only match against an existing client is only a suggestion — never auto-selected (founder correction)', async () => {
        psychologistSettingsFindUnique.mockResolvedValue({ timezone: 'Europe/Moscow' });
        calendarIntegrationFindMany.mockResolvedValue([{ id: 'integration-1', provider: 'google' }]);
        fetchGoogleCalendarEvents.mockResolvedValue({ success: true, events: [googleEvent()] });
        diaryClientFindMany.mockResolvedValue([{ id: 'client-1', name: 'Иван Иванов', phone: null, email: null }]);

        const { GET } = await import('../src/app/api/diary/calendar/import/preview/route');
        const res = await GET();
        const body = await res.json();

        expect(body.items[0].suggestedClientId).toBe('client-1');
        expect(body.items[0].resolvedClientId).toBeNull();
        expect(body.items[0].reviewState).toBe('review');
        expect(body.counts.ready).toBe(0);
    });

    it('flags classification=skipped when an existing session already occupies that date+time+name', async () => {
        psychologistSettingsFindUnique.mockResolvedValue({ timezone: 'Europe/Moscow' });
        calendarIntegrationFindMany.mockResolvedValue([{ id: 'integration-1', provider: 'google' }]);
        fetchGoogleCalendarEvents.mockResolvedValue({ success: true, events: [googleEvent()] });
        diarySessionFindMany.mockResolvedValue([{
            date: new Date('2026-09-07T00:00:00Z'), time: '09:00', client: { name: 'Иван Иванов' },
        }]);

        const { GET } = await import('../src/app/api/diary/calendar/import/preview/route');
        const res = await GET();
        const body = await res.json();

        expect(body.items[0].classification).toBe('skipped');
        expect(body.counts.skipped).toBe(1);
    });
});
