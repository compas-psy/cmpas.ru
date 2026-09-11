import { createHash, randomUUID } from 'crypto';
import { db } from '@/lib/db';

/**
 * Документы специалиста для клиентов — ядро без сессии.
 *
 * Это документы САМОГО специалиста: информированное согласие, договор,
 * памятка. Их он показывает клиенту, и они не имеют отношения к
 * центральным документам сервиса, которые специалист принимает сам.
 *
 * Ядро вынесено, потому что заводить документ нужно из двух мест: из
 * веб-кабинета (server action, психолог из сессии) и из приложения
 * (маршрут, психолог из ключа устройства). Две копии одной записи в базу
 * разошлись бы молча — и разошлись бы именно в подсчёте отпечатка, то есть
 * в том, чем один документ отличается от другого.
 */

export type SpecialistDocument = {
    id: string;
    title: string;
    type: string;
    version: string;
    fileUrl: string | null;
    isActive: boolean;
    sendOnNewClient: boolean;
    sendOnFirstSession: boolean;
    requiresAcknowledgement: boolean;
    deliveriesCount: number;
    createdAt: Date;
};

export async function listSpecialistDocuments(psychologistId: string): Promise<SpecialistDocument[]> {
    return db.$queryRaw<SpecialistDocument[]>`
        SELECT d.id, d.title, d.type, d.version, d."fileUrl", d."isActive",
               d."sendOnNewClient", d."sendOnFirstSession", d."requiresAcknowledgement",
               COUNT(cd.id)::int as "deliveriesCount", d."createdAt"
        FROM "PsychologistClientDocument" d
        LEFT JOIN "ClientDocumentDelivery" cd ON cd."documentId" = d.id
        WHERE d."psychologistId" = ${psychologistId}
        GROUP BY d.id
        ORDER BY d."isActive" DESC, d."sortOrder" ASC, d."createdAt" DESC
    `;
}

export type CreateSpecialistDocumentInput = {
    title: string;
    type?: string;
    version?: string;
    content?: string | null;
    fileUrl?: string | null;
    fileName?: string | null;
    fileMimeType?: string | null;
    fileSizeBytes?: number | null;
    sendOnNewClient?: boolean;
    sendOnFirstSession?: boolean;
    requiresAcknowledgement?: boolean;
};

export type CreateSpecialistDocumentResult =
    | { ok: true; id: string }
    | { ok: false; error: 'TITLE_REQUIRED' | 'CONTENT_REQUIRED' | 'LINK_INVALID' };

/**
 * Отпечаток считается от названия, редакции, текста и адреса файла.
 *
 * Он и отличает одну редакцию документа от другой в журнале доставок: по
 * нему видно, ЧТО именно получил клиент, даже если документ потом
 * переписали. Поэтому правило подсчёта живёт в одном месте.
 */
export function documentContentHash(title: string, version: string, content: string, fileUrl: string | null): string {
    return createHash('sha256').update(`${title}:${version}:${content}:${fileUrl || ''}`).digest('hex');
}

export async function createSpecialistDocument(
    psychologistId: string,
    data: CreateSpecialistDocumentInput,
): Promise<CreateSpecialistDocumentResult> {
    const title = data.title?.trim();
    const content = data.content?.trim() || '';
    const fileUrl = data.fileUrl?.trim() || null;

    if (!title) return { ok: false, error: 'TITLE_REQUIRED' };
    // Документ без текста и без файла — пустое обещание клиенту: он получит
    // ссылку, за которой ничего нет.
    if (!content && !fileUrl) return { ok: false, error: 'CONTENT_REQUIRED' };
    if (fileUrl && !/^https?:\/\/\S+$/i.test(fileUrl)) return { ok: false, error: 'LINK_INVALID' };

    const id = randomUUID();
    const now = new Date();
    // Редакция по умолчанию — дата: человеку она говорит больше, чем «1.0»,
    // и сама собой растёт при следующем документе.
    const version = data.version?.trim() || now.toISOString().slice(0, 10);
    const contentHash = documentContentHash(title, version, content, fileUrl);

    await db.$executeRaw`
        INSERT INTO "PsychologistClientDocument"
            (id, "psychologistId", title, type, version, content, "contentHash", "fileUrl", "fileName", "fileMimeType", "fileSizeBytes", "sendOnNewClient", "sendOnFirstSession", "requiresAcknowledgement", "isActive", "createdAt", "updatedAt")
        VALUES
            (${id}, ${psychologistId}, ${title}, ${data.type || 'custom'}, ${version}, ${content}, ${contentHash}, ${fileUrl}, ${data.fileName || null}, ${data.fileMimeType || null}, ${data.fileSizeBytes || null}, ${!!data.sendOnNewClient}, ${!!data.sendOnFirstSession}, ${!!data.requiresAcknowledgement}, true, ${now}, ${now})
    `;

    return { ok: true, id };
}

/** Документ не удаляется, а выводится из работы: доставки на него ссылаются. */
export async function setSpecialistDocumentActive(psychologistId: string, id: string, isActive: boolean): Promise<boolean> {
    const changed = await db.$executeRaw`
        UPDATE "PsychologistClientDocument"
        SET "isActive" = ${isActive}, "updatedAt" = ${new Date()}
        WHERE id = ${id} AND "psychologistId" = ${psychologistId}
    `;
    return changed > 0;
}
