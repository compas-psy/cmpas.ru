import { fetchYandexCalendarEvents } from './src/lib/calendar/yandex';
import { db } from './src/lib/db';

async function test() {
    console.log("Fetching Yandex calendars...");
    const psychologistId = 'cm7h01rnc0000aayzhyqylcv9'; // Need to find the actual ID

    // Let's first find the integration ID for Yandex
    const integration = await db.calendarIntegration.findFirst({
        where: { provider: 'yandex' }
    });

    if (!integration) {
        console.log("No yandex integration found.");
        return;
    }
    console.log("Found integration:", integration.id);

    // 24 March 2026
    const startDate = new Date('2026-03-23T00:00:00Z');
    const endDate = new Date('2026-03-25T23:59:59Z');

    const res = await fetchYandexCalendarEvents(integration.id, startDate, endDate);
    console.log(JSON.stringify(res, null, 2));
}

test().catch(console.error).finally(() => process.exit(0));
