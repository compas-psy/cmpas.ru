import { db } from '@/lib/db';
import { createNotification } from '@/lib/notifications';

async function getDelivery(deliveryId: string) {
    const rows = await db.$queryRaw<Array<{
        id: string;
        psychologistId: string;
        clientId: string;
        sessionId: string | null;
        documentTitle: string;
        documentVersion: string;
        clientName: string;
    }>>`
        SELECT d.id, d."psychologistId", d."clientId", d."sessionId", d."documentTitle", d."documentVersion", c.name as "clientName"
        FROM "ClientDocumentDelivery" d
        JOIN "DiaryClient" c ON c.id = d."clientId"
        WHERE d.id = ${deliveryId}
        LIMIT 1
    `;
    return rows[0] || null;
}

export async function notifyDocumentDeliveryEvent(deliveryId: string, event: 'opened' | 'acknowledged') {
    const delivery = await getDelivery(deliveryId).catch(() => null);
    if (!delivery) return false;

    const type = event === 'acknowledged' ? 'document_acknowledged' : 'document_opened';
    const title = event === 'acknowledged' ? 'Документ подтверждён' : 'Документ открыт';
    const subtitle = `${delivery.clientName} · ${delivery.documentTitle} · версия ${delivery.documentVersion}`;

    const existing = await db.practiceNotification.count({
        where: {
            psychologistId: delivery.psychologistId,
            type,
            title,
            subtitle,
            clientId: delivery.clientId,
            sessionId: delivery.sessionId,
        },
    }).catch(() => 0);
    if (existing > 0) return false;

    await createNotification({
        psychologistId: delivery.psychologistId,
        type,
        title,
        subtitle,
        clientId: delivery.clientId,
        sessionId: delivery.sessionId,
    });
    return true;
}
