// Task 10 (founder review fix): the import-preview route used to derive
// date/time with `date.getHours()`/`getMinutes()` — the SERVER's OS
// timezone, not the practice's configured one. It now delegates entirely to
// fetchGoogleCalendarEvents' normalized date/startTime/endTime, resolved
// against the practice's real timezone. Also verifies the stable
// provider-id-based candidate id (never a hash of summary/time) and that
// all-day events are excluded as import candidates.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const auth = vi.fn();
vi.mock('@/auth', () => ({ auth: (...args: unknown[]) => auth(...args) }));

const psychologistSettingsFindUnique = vi.fn();
const calendarIntegrationFindMany = vi.fn();
const diarySessionFindMany = vi.fn();
vi.mock('@/lib/db', () => ({
    db: {
        psychologistSettings: { findUnique: (...args: unknown[]) => psychologistSettingsFindUnique(...args) },
        calendarIntegration: { findMany: (...args: unknown[]) => calendarIntegrationFindMany(...args) },
        diarySession: { findMany: (...args: unknown[]) => diarySessionFindMany(...args) },
    },
}));

const fetchGoogleCalendarEvents = vi.fn();
vi.mock('@/lib/calendar/google', () => ({
    fetchGoogleCalendarEvents: (...args: unknown[]) => fetchGoogleCalendarEvents(...args),
}));

function req(url = 'https://cmpas.ru/api/diary/calendar/import/preview') {
    return { nextUrl: new URL(url) } as any;
}

describe('GET /api/diary/calendar/import/preview (Task 10)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        auth.mockResolvedValue({ user: { id: 'psy-1' } });
        calendarIntegrationFindMany.mockResolvedValue([{ id: 'integration-1', provider: 'google', calendarId: 'primary' }]);
        diarySessionFindMany.mockResolvedValue([]);
    });

    it('passes the practice timezone through to the fetcher — never derives time from the server local clock', async () => {
        psychologistSettingsFindUnique.mockResolvedValue({ timezone: 'Asia/Yekaterinburg' });
        fetchGoogleCalendarEvents.mockResolvedValue({ success: true, events: [] });

        const { GET } = await import('../src/app/api/diary/calendar/import/preview/route');
        await GET(req());

        expect(fetchGoogleCalendarEvents).toHaveBeenCalledWith(
            'integration-1', expect.any(Date), expect.any(Date),
            expect.objectContaining({ timezone: 'Asia/Yekaterinburg' }),
        );
    });

    it('defaults to Europe/Moscow when the psychologist has no timezone setting', async () => {
        psychologistSettingsFindUnique.mockResolvedValue(null);
        fetchGoogleCalendarEvents.mockResolvedValue({ success: true, events: [] });

        const { GET } = await import('../src/app/api/diary/calendar/import/preview/route');
        await GET(req());

        expect(fetchGoogleCalendarEvents).toHaveBeenCalledWith(
            'integration-1', expect.any(Date), expect.any(Date),
            expect.objectContaining({ timezone: 'Europe/Moscow' }),
        );
    });

    it('uses the normalized date/startTime/endTime verbatim (already resolved against the practice timezone)', async () => {
        psychologistSettingsFindUnique.mockResolvedValue({ timezone: 'Europe/Moscow' });
        const start = new Date('2026-09-07T06:00:00Z');
        const end = new Date('2026-09-07T06:50:00Z');
        fetchGoogleCalendarEvents.mockResolvedValue({
            success: true,
            events: [{
                provider: 'google', externalId: 'evt-1', summary: 'Сессия — Иван Иванов',
                start, end, date: '2026-09-07', startTime: '09:00', endTime: '09:50',
                isAllDay: false, isOwnSession: false, ownSessionId: null,
            }],
        });

        const { GET } = await import('../src/app/api/diary/calendar/import/preview/route');
        const res = await GET(req());
        const body = await res.json();

        expect(body.items).toHaveLength(1);
        expect(body.items[0]).toMatchObject({ date: '2026-09-07', startTime: '09:00', endTime: '09:50' });
        // Stable id built from the provider's own externalId, not a hash of display fields.
        expect(body.items[0].id).toBe('google:integration-1:evt-1');
    });

    it('excludes all-day events from import candidates', async () => {
        psychologistSettingsFindUnique.mockResolvedValue({ timezone: 'Europe/Moscow' });
        fetchGoogleCalendarEvents.mockResolvedValue({
            success: true,
            events: [{
                provider: 'google', externalId: 'evt-allday', summary: 'Отпуск',
                start: new Date('2026-09-10T00:00:00Z'), end: new Date('2026-09-11T00:00:00Z'),
                date: '2026-09-10', startTime: '00:00', endTime: '00:00',
                isAllDay: true, isOwnSession: false, ownSessionId: null,
            }],
        });

        const { GET } = await import('../src/app/api/diary/calendar/import/preview/route');
        const res = await GET(req());
        const body = await res.json();

        expect(body.items).toHaveLength(0);
    });
});
