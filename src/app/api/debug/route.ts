import { db } from '@/lib/db';
import { fetchGoogleCalendarEvents } from '@/lib/calendar/google';
import { fetchYandexCalendarEvents } from '@/lib/calendar/yandex';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
    try {
        const integrations = await db.calendarIntegration.findMany({
            where: { isActive: true, syncFrom: true }
        });

        const dayStart = new Date('2026-03-01T00:00:00.000Z');
        const dayEnd = new Date('2026-03-31T23:59:59.000Z');

        const results = [];
        for (const integration of integrations) {
            let res;
            if (integration.provider === 'google') {
                res = await fetchGoogleCalendarEvents(integration.id, dayStart, dayEnd);
            } else if (integration.provider === 'yandex') {
                res = await fetchYandexCalendarEvents(integration.id, dayStart, dayEnd);
            }

            if (res && res.success && res.events) {
                const mapped = res.events.map((ev: any) => {
                    const localStart = new Date(ev.start);
                    const localEnd = new Date(ev.end);
                    return {
                        date: new Date(Date.UTC(localStart.getFullYear(), localStart.getMonth(), localStart.getDate())).toISOString().slice(0, 10),
                        startTime: `${String(localStart.getHours()).padStart(2, '0')}:${String(localStart.getMinutes()).padStart(2, '0')}`,
                        endTime: `${String(localEnd.getHours()).padStart(2, '0')}:${String(localEnd.getMinutes()).padStart(2, '0')}`,
                    };
                });
                results.push({
                    provider: integration.provider,
                    eventsCount: res.events.length,
                    first3Events: res.events.slice(0, 3),
                    first3Mapped: mapped.slice(0, 3)
                });
            } else {
                results.push({ provider: integration.provider, errorOrRes: res });
            }
        }

        return NextResponse.json({ success: true, results });
    } catch (e: any) {
        return NextResponse.json({ success: false, error: e.message });
    }
}
