import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Подпись под документом, которую специалист не увидел.
 *
 * 08.09.2026 клиент подписал информированное согласие: отметка в карточке
 * проставилась, уведомления не было. В базе на тот момент — три подписи и
 * ДВА уведомления, и ровно одна пара «клиент + документ + версия» вручалась
 * дважды.
 *
 * Причина: повтор гасился по совпадению заголовка и подзаголовка, а
 * подзаголовок складывается из имени клиента, названия документа и версии.
 * У второго вручения ТОГО ЖЕ документа тому же клиенту он совпадал
 * полностью — и настоящая подпись считалась повтором уже показанного.
 *
 * Гасить всё равно надо: страница документа зовёт уведомление на КАЖДОМ
 * открытии. Поэтому проверяется и то и другое: повтор одного события гасится,
 * два разных события — нет.
 */

const deliveries: Record<string, {
    id: string; psychologistId: string; clientId: string; sessionId: string | null;
    documentTitle: string; documentVersion: string; clientName: string;
}> = {};

let rows: Array<{ psychologistId: string; type: string; refId: string | null; title: string; subtitle: string | null }> = [];

vi.mock('@/lib/db', () => ({
    db: {
        $queryRaw: vi.fn(async (_strings: TemplateStringsArray, deliveryId: string) => {
            const found = deliveries[deliveryId];
            return found ? [found] : [];
        }),
        practiceNotification: {
            count: vi.fn(async ({ where }: { where: { psychologistId: string; type: string; refId?: string | null } }) =>
                rows.filter(r =>
                    r.psychologistId === where.psychologistId
                    && r.type === where.type
                    && (where.refId === undefined || r.refId === where.refId),
                ).length),
        },
    },
}));

const created: Array<Record<string, unknown>> = [];
vi.mock('@/lib/notifications', () => ({
    createNotification: vi.fn(async (params: Record<string, unknown>) => {
        created.push(params);
        rows.push({
            psychologistId: params.psychologistId as string,
            type: params.type as string,
            refId: (params.refId as string | null) ?? null,
            title: params.title as string,
            subtitle: (params.subtitle as string | null) ?? null,
        });
    }),
}));

import { notifyDocumentDeliveryEvent } from '@/lib/document-delivery-notifications';

function delivery(id: string, over: Partial<(typeof deliveries)[string]> = {}) {
    deliveries[id] = {
        id,
        psychologistId: 'psy-1',
        clientId: 'client-1',
        sessionId: null,
        documentTitle: 'Информированное согласие',
        documentVersion: '2026-04-01',
        clientName: 'Аркадий Сергеев',
        ...over,
    };
}

describe('уведомление о подписанном документе', () => {
    beforeEach(() => {
        rows = [];
        created.length = 0;
        for (const key of Object.keys(deliveries)) delete deliveries[key];
    });

    it('подпись под документом создаёт уведомление', async () => {
        delivery('d1');
        expect(await notifyDocumentDeliveryEvent('d1', 'acknowledged')).toBe(true);
        expect(created).toHaveLength(1);
        expect(created[0].type).toBe('document_acknowledged');
        expect(created[0].refId).toBe('d1');
    });

    it('ТОТ ЖЕ документ, врученный второй раз, уведомляет о второй подписи', async () => {
        // Ровно случай 08.09: одно согласие, два вручения, две подписи —
        // и второй специалист не увидел.
        delivery('d1');
        delivery('d2'); // тот же клиент, то же название, та же версия
        await notifyDocumentDeliveryEvent('d1', 'acknowledged');
        await notifyDocumentDeliveryEvent('d2', 'acknowledged');
        expect(created).toHaveLength(2);
        expect(created.map(c => c.refId)).toEqual(['d1', 'd2']);
    });

    it('повторный вызов по ОДНОМУ вручению уведомляет один раз', async () => {
        // Страница документа зовёт это на каждом открытии: без гашения
        // «Документ открыт» приходило бы на каждое обновление страницы.
        delivery('d1');
        expect(await notifyDocumentDeliveryEvent('d1', 'opened')).toBe(true);
        expect(await notifyDocumentDeliveryEvent('d1', 'opened')).toBe(false);
        expect(await notifyDocumentDeliveryEvent('d1', 'opened')).toBe(false);
        expect(created).toHaveLength(1);
    });

    it('открытие и подпись — разные события одного вручения', async () => {
        delivery('d1');
        await notifyDocumentDeliveryEvent('d1', 'opened');
        await notifyDocumentDeliveryEvent('d1', 'acknowledged');
        expect(created.map(c => c.type)).toEqual(['document_opened', 'document_acknowledged']);
    });

    it('одинаковые документы у РАЗНЫХ клиентов не гасят друг друга', async () => {
        delivery('d1', { clientId: 'client-1' });
        delivery('d2', { clientId: 'client-2', clientName: 'Другой человек' });
        await notifyDocumentDeliveryEvent('d1', 'acknowledged');
        await notifyDocumentDeliveryEvent('d2', 'acknowledged');
        expect(created).toHaveLength(2);
    });

    it('несуществующее вручение ничего не создаёт и не падает', async () => {
        expect(await notifyDocumentDeliveryEvent('нет-такого', 'acknowledged')).toBe(false);
        expect(created).toHaveLength(0);
    });
});
