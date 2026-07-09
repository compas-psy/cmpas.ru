import { createHash, randomUUID } from 'crypto';
import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db';

export async function POST(req: Request) {
    const session = await auth();
    const psychologistId = session?.user?.id;
    if (!psychologistId) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    try {
        const body = await req.json();
        const title = String(body.title || '').trim();
        const content = String(body.content || '').trim();
        if (!title) return NextResponse.json({ success: false, error: 'Название документа обязательно' }, { status: 400 });
        if (!content) return NextResponse.json({ success: false, error: 'В onboarding нужен текст документа' }, { status: 400 });

        const id = randomUUID();
        const now = new Date();
        const version = String(body.version || new Date().toISOString().slice(0, 10)).trim();
        const type = String(body.type || 'informed_consent').trim();
        const contentHash = createHash('sha256').update(`${title}:${version}:${content}`).digest('hex');

        await db.$executeRaw`
            INSERT INTO "PsychologistClientDocument"
                (id, "psychologistId", title, type, version, content, "contentHash", "sendOnNewClient", "sendOnFirstSession", "requiresAcknowledgement", "isActive", "createdAt", "updatedAt")
            VALUES
                (${id}, ${psychologistId}, ${title}, ${type}, ${version}, ${content}, ${contentHash}, ${Boolean(body.sendOnNewClient)}, ${Boolean(body.sendOnFirstSession)}, ${body.requiresAcknowledgement !== false}, true, ${now}, ${now})
        `;

        return NextResponse.json({ success: true, id });
    } catch (error) {
        console.error('[onboarding/client-document POST]', error);
        return NextResponse.json({ success: false, error: 'Не удалось сохранить документ' }, { status: 500 });
    }
}
