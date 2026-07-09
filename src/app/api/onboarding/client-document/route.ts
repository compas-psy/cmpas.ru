import { NextResponse } from 'next/server';
import { createSpecialistClientDocument } from '@/app/diary/actions/client-documents';

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const result = await createSpecialistClientDocument({
            title: String(body.title || '').trim(),
            type: body.type || 'contract',
            version: String(body.version || new Date().toISOString().slice(0, 10)).trim(),
            content: String(body.content || '').trim(),
            sendOnNewClient: Boolean(body.sendOnNewClient),
            sendOnFirstSession: Boolean(body.sendOnFirstSession),
            requiresAcknowledgement: body.requiresAcknowledgement !== false,
        });
        return NextResponse.json(result, { status: result.success ? 200 : 400 });
    } catch (error) {
        console.error('[onboarding/client-document POST]', error);
        return NextResponse.json({ success: false, error: 'Не удалось сохранить документ' }, { status: 500 });
    }
}
