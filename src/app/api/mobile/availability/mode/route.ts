import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateMobileRequest, unauthorizedResponse } from '@/lib/mobile-auth';
import { requirePracticeOperatorAttestation, ATTESTATION_REQUIRED_CODE } from '@/lib/practice/attestation';

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
        if (mode === 'booking') {
            await requirePracticeOperatorAttestation(auth.userId);
        }

        const settings = await db.psychologistSettings.upsert({
            where: { psychologistId: auth.userId },
            update: { scheduleMode: mode },
            create: { psychologistId: auth.userId, scheduleMode: mode },
            select: { scheduleMode: true },
        });

        return NextResponse.json({ success: true, scheduleMode: settings.scheduleMode });
    } catch (error) {
        if (error instanceof Error && error.message === ATTESTATION_REQUIRED_CODE) {
            return NextResponse.json({ error: ATTESTATION_REQUIRED_CODE }, { status: 403 });
        }
        console.error('[mobile/availability/mode PATCH]', error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
