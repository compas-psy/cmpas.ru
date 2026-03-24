import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { fetchGoogleCalendarEvents } from '@/lib/calendar/google';
import { fetchYandexCalendarEvents } from '@/lib/calendar/yandex';

function getPartsInTz(date: Date, timeZone: string) {
    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone,
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', hour12: false
    });
    const parts = formatter.formatToParts(date);
    const get = (type: string) => parts.find(p => p.type === type)?.value || '00';
    let hour = get('hour');
    if (hour === '24') hour = '00';
    return {
        year: Number(get('year')),
        month: Number(get('month')),
        day: Number(get('day')),
        hour,
        minute: get('minute')
    };
}

export async function GET(req: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const psychologistId = session.user.id;
    const dateStr = req.nextUrl.searchParams.get('date') || '2026-03-27';
    const [year, month, day] = dateStr.split('-').map(Number);
    const dayStart = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
    const dayEnd = new Date(Date.UTC(year, month - 1, day, 23, 59, 59));

    const diag: Record<string, any> = {
        psychologistId,
        dateStr,
        dayStart: dayStart.toISOString(),
        dayEnd: dayEnd.toISOString(),
    };

    // 1. Settings
    const settings = await db.psychologistSettings.findUnique({ where: { psychologistId } });
    diag.settings = settings ? { blockConflicts: settings.blockConflicts, timezone: settings.timezone } : null;
    const blockConflicts = settings?.blockConflicts ?? true;
    diag.blockConflictsResolved = blockConflicts;

    // 2. ALL integrations (unfiltered)
    const allIntegrations = await db.calendarIntegration.findMany({
        where: { psychologistId },
        select: { id: true, provider: true, isActive: true, syncFrom: true, calendarId: true, caldavLogin: true }
    });
    diag.allIntegrations = allIntegrations.map(i => ({
        id: i.id,
        provider: i.provider,
        isActive: i.isActive,
        syncFrom: i.syncFrom,
        hasCalendarId: !!i.calendarId,
        hasCaldavLogin: !!i.caldavLogin,
    }));

    // 3. Filtered integrations
    const integrations = allIntegrations.filter(i => i.isActive && i.syncFrom);
    diag.filteredIntegrationCount = integrations.length;

    // 4. Fetch events from each integration
    const fetchResults: any[] = [];
    const externalBlocks: any[] = [];
    const tz = settings?.timezone || 'Europe/Moscow';

    for (const integration of integrations) {
        const entry: Record<string, any> = {
            id: integration.id,
            provider: integration.provider,
        };

        try {
            let res: any;
            if (integration.provider === 'google') {
                res = await fetchGoogleCalendarEvents(integration.id, dayStart, dayEnd);
            } else if (integration.provider === 'yandex') {
                res = await fetchYandexCalendarEvents(integration.id, dayStart, dayEnd);
            }

            entry.success = res?.success;
            entry.error = res?.error || null;
            entry.eventCount = res?.events?.length || 0;
            entry._rawSamples = res?._rawSamples || [];
            entry.rawEvents = (res?.events || []).slice(0, 5).map((ev: any) => ({
                start: ev.start?.toISOString?.() || String(ev.start),
                end: ev.end?.toISOString?.() || String(ev.end),
                summary: ev.summary,
                startLocalStr: ev.startLocalStr || null,
                endLocalStr: ev.endLocalStr || null,
            }));

            if (res?.success && res?.events) {
                const mapped = res.events.map((ev: any) => {
                    let date: Date, startTime: string, endTime: string;

                    if (ev.startLocalStr) {
                        const [datePart, timePart] = ev.startLocalStr.split('T');
                        const [y, m, d] = datePart.split('-').map(Number);
                        date = new Date(Date.UTC(y, m - 1, d));
                        startTime = timePart.slice(0, 5);
                    } else {
                        const p = getPartsInTz(new Date(ev.start), tz);
                        date = new Date(Date.UTC(p.year, p.month - 1, p.day));
                        startTime = `${p.hour}:${p.minute}`;
                    }

                    if (ev.endLocalStr) {
                        endTime = ev.endLocalStr.split('T')[1].slice(0, 5);
                    } else {
                        const p = getPartsInTz(new Date(ev.end), tz);
                        endTime = `${p.hour}:${p.minute}`;
                    }

                    return { date: date.toISOString(), startTime, endTime, _external: true };
                });
                entry.mappedBlocks = mapped;
                externalBlocks.push(...mapped);
            }
        } catch (err: any) {
            entry.exception = err?.message || String(err);
        }

        fetchResults.push(entry);
    }

    diag.fetchResults = fetchResults;
    diag.externalBlocks = externalBlocks;

    // 5. Diary blocks
    const diaryBlocks = await db.diaryBlock.findMany({
        where: { psychologistId, date: { gte: dayStart, lte: dayEnd } },
        select: { id: true, date: true, startTime: true, endTime: true, reason: true }
    });
    diag.diaryBlocks = diaryBlocks;

    // 6. Sessions
    const sessions = await db.diarySession.findMany({
        where: { psychologistId, date: { gte: dayStart, lte: dayEnd }, status: { not: 'cancelled' } },
        select: { date: true, time: true, duration: true, status: true }
    });
    diag.sessions = sessions;

    // 7. Availability slots
    const rawSlots = await db.availabilitySlot.findMany({
        where: { psychologistId, isActive: true },
        select: { id: true, dayOfWeek: true, startTime: true, endTime: true, duration: true, format: true, startDate: true, endDate: true }
    });
    diag.rawSlots = rawSlots;

    // 8. Which day of week is this date?
    const dateObj = new Date(Date.UTC(year, month - 1, day));
    diag.dayOfWeek = (dateObj.getUTCDay() + 6) % 7; // 0=Mon, 4=Fri
    diag.dayOfWeekName = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][diag.dayOfWeek];

    return NextResponse.json(diag, { status: 200 });
}
