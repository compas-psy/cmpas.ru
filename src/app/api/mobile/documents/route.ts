import { NextRequest, NextResponse } from 'next/server';
import { authenticateMobileRequest, unauthorizedResponse } from '@/lib/mobile-auth';
import {
    listSpecialistDocuments,
    createSpecialistDocument,
    type CreateSpecialistDocumentResult,
} from '@/lib/practice/client-documents';

/**
 * Документы специалиста для клиентов.
 *
 * В приложении раздел «Документы» показывал только центральные документы
 * сервиса — те, что специалист принимает сам. Его собственные —
 * информированное согласие, договор, памятка — не показывались вовсе, хотя
 * именно они нужны ему каждый день: их получает клиент.
 *
 * Ядро общее с веб-кабинетом (src/lib/practice/client-documents.ts): две
 * записи одного документа разошлись бы в подсчёте отпечатка, то есть ровно
 * в том, чем одна редакция отличается от другой в журнале доставок.
 */
export async function GET(req: NextRequest) {
    const auth = await authenticateMobileRequest(req);
    if (!auth) return unauthorizedResponse();

    try {
        const documents = await listSpecialistDocuments(auth.userId);
        return NextResponse.json({
            documents: documents.map(d => ({
                id: d.id,
                title: d.title,
                version: d.version,
                fileUrl: d.fileUrl,
                isActive: d.isActive,
                sendOnNewClient: d.sendOnNewClient,
                sendOnFirstSession: d.sendOnFirstSession,
                deliveriesCount: d.deliveriesCount,
            })),
        });
    } catch (error) {
        console.error('[mobile/documents GET]', error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}

const ERROR_STATUS: Record<Extract<CreateSpecialistDocumentResult, { ok: false }>['error'], number> = {
    TITLE_REQUIRED: 400,
    CONTENT_REQUIRED: 400,
    LINK_INVALID: 400,
};

/**
 * Заведение документа с телефона — названием и ссылкой на файл.
 *
 * Набирать полный текст согласия на телефоне никто не станет, и делать вид,
 * что станет, незачем: у специалиста файл уже есть. Текстовые документы
 * остаются веб-кабинету, и экран об этом честно говорит.
 */
export async function POST(req: NextRequest) {
    const auth = await authenticateMobileRequest(req);
    if (!auth) return unauthorizedResponse();

    try {
        const body = await req.json().catch(() => null) as {
            title?: unknown;
            fileUrl?: unknown;
            sendOnNewClient?: unknown;
            sendOnFirstSession?: unknown;
        } | null;

        const result = await createSpecialistDocument(auth.userId, {
            title: typeof body?.title === 'string' ? body.title : '',
            fileUrl: typeof body?.fileUrl === 'string' ? body.fileUrl : null,
            sendOnNewClient: body?.sendOnNewClient === true,
            sendOnFirstSession: body?.sendOnFirstSession === true,
        });

        if (!result.ok) {
            return NextResponse.json({ error: result.error }, { status: ERROR_STATUS[result.error] });
        }
        return NextResponse.json({ id: result.id }, { status: 201 });
    } catch (error) {
        console.error('[mobile/documents POST]', error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
