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
        const block = await db.diaryBlock.findFirst({
            where: { id, psychologistId: auth.userId },
        });
        if (!block) return NextResponse.json({ error: 'Not found' }, { status: 404 });

        await db.diaryBlock.delete({ where: { id } });
        return NextResponse.json({ ok: true });
    } catch (error) {
        console.error('[mobile/blocks/id DELETE]', error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
