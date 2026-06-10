import { NextRequest, NextResponse } from 'next/server';
import { authenticateMobileRequest, unauthorizedResponse } from '@/lib/mobile-auth';
import { getAvailableTimes } from '@/app/bot/actions';

/**
 * GET /api/mobile/sessions/free-times?date=YYYY-MM-DD&sessionId=<id>
 * Returns available time slots for the given date (for reschedule UI).
 */
export async function GET(req: NextRequest) {
    const auth = await authenticateMobileRequest(req);
    if (!auth) return unauthorizedResponse();

    const date = req.nextUrl.searchParams.get('date');
    const sessionId = req.nextUrl.searchParams.get('sessionId') || undefined;

    if (!date) {
        return NextResponse.json({ error: 'date required' }, { status: 400 });
    }

    try {
        // skipBuffer=true: psychologist can book at short notice
        const times = await getAvailableTimes(auth.userId, date, true, sessionId, null, true);
        return NextResponse.json({ date, times: times || [] });
    } catch (error) {
        console.error('[mobile/sessions/free-times]', error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
