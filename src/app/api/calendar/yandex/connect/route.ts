import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { testYandexConnection } from '@/lib/calendar/yandex';

export async function POST(request: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { login, password, calendarUrl } = await request.json();

    if (!login || !password) {
        return NextResponse.json({ error: 'Логин и пароль обязательны' }, { status: 400 });
    }

    // Test connection
    const test = await testYandexConnection(login, password);
    if (!test.success) {
        return NextResponse.json({
            error: `Не удалось подключиться: ${test.error}`
        }, { status: 400 });
    }

    // Use specified calendar or first available
    const selectedCalendar = calendarUrl || test.calendars?.[0]?.url;

    // Create or update integration
    const integration = await db.calendarIntegration.upsert({
        where: {
            psychologistId_provider: {
                psychologistId: session.user.id,
                provider: 'yandex',
            },
        },
        create: {
            psychologistId: session.user.id,
            provider: 'yandex',
            accountEmail: login,
            caldavLogin: login,
            caldavPassword: password,
            caldavUrl: 'https://caldav.yandex.ru',
            calendarId: selectedCalendar,
            isActive: true,
        },
        update: {
            accountEmail: login,
            caldavLogin: login,
            caldavPassword: password,
            calendarId: selectedCalendar,
            isActive: true,
        },
    });

    return NextResponse.json({
        success: true,
        integration: {
            id: integration.id,
            provider: integration.provider,
            accountEmail: integration.accountEmail,
            calendars: test.calendars,
        },
    });
}
