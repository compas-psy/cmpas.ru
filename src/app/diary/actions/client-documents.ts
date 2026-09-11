'use server';

import { auth } from '@/auth';
import { db } from '@/lib/db';
import { listSpecialistDocuments, createSpecialistDocument } from '@/lib/practice/client-documents';

async function getPsychologistId() {
    const session = await auth();
    if (!session?.user?.id) throw new Error('Unauthorized');
    return session.user.id;
}

export async function listSpecialistClientDocuments() {
    try {
        const psychologistId = await getPsychologistId();
        // Тот же запрос, что и у приложения: разойдясь, два списка молча
        // показали бы разный набор документов в вебе и на телефоне.
        return await listSpecialistDocuments(psychologistId);
    } catch (error) {
        console.error('listSpecialistClientDocuments failed:', error);
        return [];
    }
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
    try {
        const psychologistId = await getPsychologistId();
        const result = await createSpecialistDocument(psychologistId, data);
        if (result.ok) return { success: true, id: result.id };

        // Причина называется словами, а не кодом: она видна человеку в форме.
        const message = {
            TITLE_REQUIRED: 'Название документа обязательно',
            CONTENT_REQUIRED: 'Нужен текст документа или файл',
            LINK_INVALID: 'Ссылка должна начинаться с http:// или https://',
        }[result.error];
        return { success: false, error: message };
    } catch (error) {
        console.error('createSpecialistClientDocument failed:', error);
        return { success: false, error: 'Не удалось сохранить документ. Проверьте, что обновление сервера и базы данных завершилось.' };
    }
}

export async function setSpecialistClientDocumentActive(id: string, isActive: boolean) {
    try {
        const psychologistId = await getPsychologistId();
        const now = new Date();
        await db.$executeRaw`
            UPDATE "PsychologistClientDocument"
            SET "isActive" = ${isActive}, "updatedAt" = ${now}
            WHERE id = ${id} AND "psychologistId" = ${psychologistId}
        `;
        return { success: true };
    } catch (error) {
        console.error('setSpecialistClientDocumentActive failed:', error);
        return { success: false, error: isActive ? 'Не удалось включить документ' : 'Не удалось отключить документ' };
    }
}

export async function deleteSpecialistClientDocument(id: string) {
    try {
        const psychologistId = await getPsychologistId();
        const rows = await db.$queryRaw<Array<{ count: number }>>`
            SELECT COUNT(*)::int as count
            FROM "ClientDocumentDelivery"
            WHERE "documentId" = ${id} AND "psychologistId" = ${psychologistId}
        `;
        const count = rows[0]?.count || 0;
        if (count > 0) {
            return { success: false, error: 'Документ уже отправлялся клиентам. Его нельзя удалить, чтобы сохранить журнал. Отключите документ.' };
        }

        await db.$executeRaw`
            DELETE FROM "PsychologistClientDocument"
            WHERE id = ${id} AND "psychologistId" = ${psychologistId}
        `;
        return { success: true };
    } catch (error) {
        console.error('deleteSpecialistClientDocument failed:', error);
        return { success: false, error: 'Не удалось удалить документ' };
    }
}

export async function deactivateSpecialistClientDocument(id: string) {
    return setSpecialistClientDocumentActive(id, false);
}

export async function activateSpecialistClientDocument(id: string) {
    return setSpecialistClientDocumentActive(id, true);
}

export async function listClientDocumentDeliveries(clientId: string) {
    try {
        const psychologistId = await getPsychologistId();
        return await db.$queryRaw<Array<{
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
    } catch (error) {
        console.error('listClientDocumentDeliveries failed:', error);
        return [];
    }
}
