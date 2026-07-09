import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db';

function csvCell(value: unknown) {
    const text = value == null ? '' : String(value);
    return `"${text.replace(/"/g, '""')}"`;
}

function fmt(value: Date | null) {
    return value ? value.toISOString() : '';
}

export async function GET(req: NextRequest) {
    const session = await auth();
    const psychologistId = session?.user?.id;
    if (!psychologistId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const status = req.nextUrl.searchParams.get('status');
    const clientId = req.nextUrl.searchParams.get('clientId');
    const documentId = req.nextUrl.searchParams.get('documentId');

    try {
        const rows = await db.$queryRaw<Array<{
            status: string;
            documentTitle: string;
            documentVersion: string;
            deliveryChannel: string;
            recipientContact: string | null;
            sentAt: Date;
            openedAt: Date | null;
            acknowledgedAt: Date | null;
            clientName: string;
            clientPhone: string | null;
            clientEmail: string | null;
            sessionId: string | null;
        }>>`
            SELECT d.status, d."documentTitle", d."documentVersion", d."deliveryChannel", d."recipientContact",
                   d."sentAt", d."openedAt", d."acknowledgedAt", d."sessionId",
                   c.name as "clientName", c.phone as "clientPhone", c.email as "clientEmail"
            FROM "ClientDocumentDelivery" d
            JOIN "DiaryClient" c ON c.id = d."clientId"
            WHERE d."psychologistId" = ${psychologistId}
              AND (${status}::text IS NULL OR d.status = ${status})
              AND (${clientId}::text IS NULL OR d."clientId" = ${clientId})
              AND (${documentId}::text IS NULL OR d."documentId" = ${documentId})
            ORDER BY d."createdAt" DESC
        `;

        const header = [
            'Клиент',
            'Телефон',
            'Email',
            'Документ',
            'Версия',
            'Статус',
            'Канал',
            'Контакт доставки',
            'Отправлен',
            'Открыт',
            'Принят',
            'ID сессии',
        ];
        const lines = [header.map(csvCell).join(';')];
        for (const row of rows) {
            lines.push([
                row.clientName,
                row.clientPhone,
                row.clientEmail,
                row.documentTitle,
                row.documentVersion,
                row.status,
                row.deliveryChannel,
                row.recipientContact,
                fmt(row.sentAt),
                fmt(row.openedAt),
                fmt(row.acknowledgedAt),
                row.sessionId,
            ].map(csvCell).join(';'));
        }

        // UTF-8 BOM helps Excel on Windows open Cyrillic CSV correctly.
        const csv = '\uFEFF' + lines.join('\n');
        const fileDate = new Date().toISOString().slice(0, 10);
        return new NextResponse(csv, {
            status: 200,
            headers: {
                'content-type': 'text/csv; charset=utf-8',
                'content-disposition': `attachment; filename="cmpas-document-deliveries-${fileDate}.csv"`,
                'cache-control': 'no-store',
            },
        });
    } catch (error) {
        console.error('[diary/documents/deliveries/export GET]', error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
