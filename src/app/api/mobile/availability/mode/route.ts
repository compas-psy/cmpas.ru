import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateMobileRequest, unauthorizedResponse } from '@/lib/mobile-auth';

const ALLOWED_MODES = new Set(['private', 'readonly', 'booking']);

export async function PATCH(req: NextRequest) {
    const auth = await authenticateMobileRequest(req);
    if (!auth) return unauthorizedResponse();

    try {
        const body = await req.json().catch(() => ({}));
        const mode = typeof body.scheduleMode === 'string' ? body.scheduleMode.trim() : '';
        if (!ALLOWED_MODES.has(mode)) {
            return NextResponse.json({ error: 'scheduleMode must be private, readonly or booking' }, { status: 400 });
        }

        const settings = await db.psychologistSettings.upsert({
            where: { psychologistId: auth.userId },
            update: { scheduleMode: mode },
            create: { psychologistId: auth.userId, scheduleMode: mode },
            select: { scheduleMode: true },
        });

        return NextResponse.json({ success: true, scheduleMode: settings.scheduleMode });
    } catch (error) {
        console.error('[mobile/availability/mode PATCH]', error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
