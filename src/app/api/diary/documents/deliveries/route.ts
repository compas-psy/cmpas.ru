import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db';

async function currentUserId() {
    const session = await auth();
    return session?.user?.id || null;
}

export async function GET(req: NextRequest) {
    const psychologistId = await currentUserId();
    if (!psychologistId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const status = req.nextUrl.searchParams.get('status');
    const clientId = req.nextUrl.searchParams.get('clientId');
    const documentId = req.nextUrl.searchParams.get('documentId');
    const consent = req.nextUrl.searchParams.get('consent');
    const limit = Math.min(Number(req.nextUrl.searchParams.get('limit') || 100), 300);

    try {
        const rows = await db.$queryRaw<Array<{
            id: string;
            status: string;
            documentId: string;
            documentTitle: string;
            documentVersion: string;
            documentContentHash: string;
            deliveryChannel: string;
            recipientContact: string | null;
            sentAt: Date;
            openedAt: Date | null;
            acknowledgedAt: Date | null;
            clientId: string;
            clientName: string;
            sessionId: string | null;
            createdAt: Date;
            updatedAt: Date;
        }>>`
            SELECT d.id, d.status, d."documentId", d."documentTitle", d."documentVersion", d."documentContentHash", d."deliveryChannel", d."recipientContact",
                   d."sentAt", d."openedAt", d."acknowledgedAt", d."clientId", d."sessionId", d."createdAt", d."updatedAt",
                   c.name as "clientName"
            FROM "ClientDocumentDelivery" d
            JOIN "DiaryClient" c ON c.id = d."clientId"
            WHERE d."psychologistId" = ${psychologistId}
              AND (${status}::text IS NULL OR d.status = ${status})
              AND (${clientId}::text IS NULL OR d."clientId" = ${clientId})
              AND (${documentId}::text IS NULL OR d."documentId" = ${documentId})
              AND (${consent}::text IS NULL OR (${consent} = 'missing' AND d."acknowledgedAt" IS NULL) OR (${consent} = 'accepted' AND d."acknowledgedAt" IS NOT NULL))
            ORDER BY d."createdAt" DESC
            LIMIT ${limit}
        `;

        return NextResponse.json({
            items: rows.map((row) => ({
                id: row.id,
                status: row.status,
                documentId: row.documentId,
                documentTitle: row.documentTitle,
                documentVersion: row.documentVersion,
                documentContentHash: row.documentContentHash,
                deliveryChannel: row.deliveryChannel,
                recipientContact: row.recipientContact,
                sentAt: row.sentAt.toISOString(),
                openedAt: row.openedAt?.toISOString() || null,
                acknowledgedAt: row.acknowledgedAt?.toISOString() || null,
                clientId: row.clientId,
                clientName: row.clientName,
                sessionId: row.sessionId,
                createdAt: row.createdAt.toISOString(),
                updatedAt: row.updatedAt.toISOString(),
            })),
        });
    } catch (error) {
        console.error('[diary/documents/deliveries GET]', error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
