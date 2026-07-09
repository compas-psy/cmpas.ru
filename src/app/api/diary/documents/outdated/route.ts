import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db';

export async function GET(req: NextRequest) {
    const session = await auth();
    const psychologistId = session?.user?.id;
    if (!psychologistId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const documentId = req.nextUrl.searchParams.get('documentId');
    if (!documentId) return NextResponse.json({ error: 'documentId required' }, { status: 400 });

    try {
        const docs = await db.$queryRaw<Array<{ id: string; type: string; version: string; title: string }>>`
            SELECT id, type, version, title
            FROM "PsychologistClientDocument"
            WHERE id = ${documentId} AND "psychologistId" = ${psychologistId} AND "isActive" = true
            LIMIT 1
        `;
        const doc = docs[0];
        if (!doc) return NextResponse.json({ error: 'Document not found' }, { status: 404 });

        const rows = await db.$queryRaw<Array<{
            clientId: string;
            clientName: string;
            latestVersion: string;
            latestAcknowledgedAt: Date | null;
            latestSentAt: Date;
        }>>`
            WITH same_type_docs AS (
                SELECT id FROM "PsychologistClientDocument"
                WHERE "psychologistId" = ${psychologistId} AND type = ${doc.type}
            ), ranked AS (
                SELECT d."clientId", c.name as "clientName", d."documentVersion" as "latestVersion",
                       d."acknowledgedAt" as "latestAcknowledgedAt", d."sentAt" as "latestSentAt",
                       ROW_NUMBER() OVER (PARTITION BY d."clientId" ORDER BY d."sentAt" DESC, d."createdAt" DESC) as rn
                FROM "ClientDocumentDelivery" d
                JOIN "DiaryClient" c ON c.id = d."clientId"
                WHERE d."psychologistId" = ${psychologistId}
                  AND d."documentId" IN (SELECT id FROM same_type_docs)
            )
            SELECT "clientId", "clientName", "latestVersion", "latestAcknowledgedAt", "latestSentAt"
            FROM ranked
            WHERE rn = 1 AND "latestVersion" <> ${doc.version}
            ORDER BY "clientName" ASC
        `;

        return NextResponse.json({
            document: doc,
            count: rows.length,
            clients: rows.map((row) => ({
                clientId: row.clientId,
                clientName: row.clientName,
                latestVersion: row.latestVersion,
                latestAcknowledgedAt: row.latestAcknowledgedAt?.toISOString() || null,
                latestSentAt: row.latestSentAt.toISOString(),
            })),
        });
    } catch (error) {
        console.error('[diary/documents/outdated GET]', error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
