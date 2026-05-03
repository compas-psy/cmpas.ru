import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateMobileRequest, unauthorizedResponse } from '@/lib/mobile-auth';

/**
 * PATCH /api/mobile/sessions/[id]
 * Update session status/notes.
 */
export async function PATCH(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    const auth = await authenticateMobileRequest(req);
    if (!auth) return unauthorizedResponse();

    try {
        const body = await req.json();

        // Verify ownership
        const session = await db.diarySession.findFirst({
            where: { id: params.id, psychologistId: auth.userId },
        });

        if (!session) {
            return NextResponse.json({ error: 'Not found' }, { status: 404 });
        }

        const updateData: Record<string, unknown> = {};
        if (body.status) updateData.status = body.status.toLowerCase();
        if (body.notes !== undefined) updateData.notes = body.notes;

        const updated = await db.diarySession.update({
            where: { id: params.id },
            data: updateData,
            include: { client: { select: { id: true, name: true } } },
        });

        return NextResponse.json({
            id: updated.id,
            clientId: updated.client?.id || '',
            clientName: updated.client?.name || '',
            date: updated.date.toISOString().split('T')[0],
            startTime: updated.time,
            endTime: updated.endTime || '',
            status: (updated.status || 'PENDING').toUpperCase(),
            format: updated.format === 'in_person' || updated.format === 'offline' ? 'IN_PERSON' : 'ONLINE',
        });
    } catch (error) {
        console.error('[mobile/sessions/id]', error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
