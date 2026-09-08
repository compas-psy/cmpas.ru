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

    // Повтор гасится ПО САМОМУ ВРУЧЕНИЮ, а не по тексту уведомления.
    //
    // Раньше ключом были заголовок и подзаголовок. Подзаголовок складывается
    // из имени клиента, названия документа и версии — то есть у второго
    // вручения ТОГО ЖЕ документа тому же клиенту он совпадал полностью, и
    // настоящая подпись под ним считалась повтором уже показанного.
    //
    // 08.09.2026 так пропала подпись под информированным согласием: отметка в
    // карточке проставилась, а уведомления специалист не увидел. В базе на
    // тот момент было три подписи и два уведомления, и ровно одна пара
    // «клиент + документ + версия» вручалась дважды.
    //
    // Гасить всё равно надо: страница документа зовёт это на КАЖДОМ открытии,
    // и без гашения «Документ открыт» приходило бы на каждое обновление
    // страницы. Но гасить надо повтор ОДНОГО события, а не два разных.
    const existing = await db.practiceNotification.count({
        where: {
            psychologistId: delivery.psychologistId,
            type,
            refId: deliveryId,
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
        refId: deliveryId,
    });
    return true;
}
