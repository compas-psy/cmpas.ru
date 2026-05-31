'use server';

import { createHash, randomUUID } from 'crypto';
import { auth } from '@/auth';
import { db } from '@/lib/db';

async function getPsychologistId() {
    const session = await auth();
    if (!session?.user?.id) throw new Error('Unauthorized');
    return session.user.id;
}

export async function listSpecialistClientDocuments() {
    const psychologistId = await getPsychologistId();
    return db.$queryRaw<Array<{
        id: string;
        title: string;
        type: string;
        version: string;
        fileUrl: string | null;
        fileName: string | null;
        fileMimeType: string | null;
        isActive: boolean;
        sendOnNewClient: boolean;
        sendOnFirstSession: boolean;
        requiresAcknowledgement: boolean;
        createdAt: Date;
        updatedAt: Date;
    }>>`
        SELECT id, title, type, version, "fileUrl", "fileName", "fileMimeType", "isActive", "sendOnNewClient", "sendOnFirstSession", "requiresAcknowledgement", "createdAt", "updatedAt"
        FROM "PsychologistClientDocument"
        WHERE "psychologistId" = ${psychologistId}
        ORDER BY "isActive" DESC, "sortOrder" ASC, "createdAt" DESC
    `;
}

export async function createSpecialistClientDocument(data: {
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
}) {
    const psychologistId = await getPsychologistId();
    const title = data.title?.trim();
    if (!title) throw new Error('Название документа обязательно');
    if (!data.content && !data.fileUrl) throw new Error('Нужен текст документа или ссылка на файл');

    const id = randomUUID();
    const now = new Date();
    const version = data.version?.trim() || new Date().toISOString().slice(0, 10);
    const hashSource = `${title}:${version}:${data.content || ''}:${data.fileUrl || ''}`;
    const contentHash = createHash('sha256').update(hashSource).digest('hex');

    await db.$executeRaw`
        INSERT INTO "PsychologistClientDocument"
            (id, "psychologistId", title, type, version, content, "contentHash", "fileUrl", "fileName", "fileMimeType", "fileSizeBytes", "sendOnNewClient", "sendOnFirstSession", "requiresAcknowledgement", "isActive", "createdAt", "updatedAt")
        VALUES
            (${id}, ${psychologistId}, ${title}, ${data.type || 'custom'}, ${version}, ${data.content || null}, ${contentHash}, ${data.fileUrl || null}, ${data.fileName || null}, ${data.fileMimeType || null}, ${data.fileSizeBytes || null}, ${!!data.sendOnNewClient}, ${!!data.sendOnFirstSession}, ${!!data.requiresAcknowledgement}, true, ${now}, ${now})
    `;

    return { success: true, id };
}

export async function deactivateSpecialistClientDocument(id: string) {
    const psychologistId = await getPsychologistId();
    const now = new Date();
    await db.$executeRaw`
        UPDATE "PsychologistClientDocument"
        SET "isActive" = false, "updatedAt" = ${now}
        WHERE id = ${id} AND "psychologistId" = ${psychologistId}
    `;
    return { success: true };
}

export async function listClientDocumentDeliveries(clientId: string) {
    const psychologistId = await getPsychologistId();
    return db.$queryRaw<Array<{
        id: string;
        status: string;
        documentTitle: string;
        documentVersion: string;
        deliveryChannel: string;
        recipientContact: string | null;
        sentAt: Date;
        openedAt: Date | null;
        acknowledgedAt: Date | null;
    }>>`
        SELECT id, status, "documentTitle", "documentVersion", "deliveryChannel", "recipientContact", "sentAt", "openedAt", "acknowledgedAt"
        FROM "ClientDocumentDelivery"
        WHERE "psychologistId" = ${psychologistId} AND "clientId" = ${clientId}
        ORDER BY "createdAt" DESC
    `;
}
