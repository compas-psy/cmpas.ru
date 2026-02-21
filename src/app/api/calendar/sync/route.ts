import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { syncAllSessionsToYandex } from '@/lib/calendar/yandex';
import { syncAllSessionsToGoogle } from '@/lib/calendar/google';

export async function POST(request: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { provider } = await request.json();

    if (provider === 'yandex') {
        const result = await syncAllSessionsToYandex(session.user.id);
        return NextResponse.json(result);
    }

    if (provider === 'google') {
        const result = await syncAllSessionsToGoogle(session.user.id);
        return NextResponse.json(result);
    }

    return NextResponse.json({ error: 'Неизвестный провайдер' }, { status: 400 });
}
