import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateMobileRequest, unauthorizedResponse } from '@/lib/mobile-auth';

export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const auth = await authenticateMobileRequest(req);
    if (!auth) return unauthorizedResponse();
    const { id } = await params;

    try {
        const msg = await db.scheduledClientMessage.findFirst({
            where: { id, psychologistId: auth.userId, status: { in: ['pending', 'manual_pending'] } },
        });
        if (!msg) return NextResponse.json({ error: 'Not found or already sent' }, { status: 404 });

        await db.scheduledClientMessage.delete({ where: { id } });
        return NextResponse.json({ ok: true });
    } catch (error) {
        console.error('[mobile/scheduled-messages/id DELETE]', error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
