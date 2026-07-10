import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { createClientDocumentDelivery } from '@/lib/client-workflow';

export async function POST(req: NextRequest) {
    const session = await auth();
    const psychologistId = session?.user?.id;
    if (!psychologistId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const body = await req.json().catch(() => ({}));
        const documentId = typeof body.documentId === 'string' ? body.documentId : '';
        const clientIds = Array.isArray(body.clientIds) ? body.clientIds.filter((id: unknown) => typeof id === 'string') : [];
        if (!documentId) return NextResponse.json({ error: 'documentId required' }, { status: 400 });

        const docs = await db.$queryRaw<Array<{ id: string; type: string; version: string }>>`
            SELECT id, type, version
            FROM "PsychologistClientDocument"
            WHERE id = ${documentId} AND "psychologistId" = ${psychologistId} AND "isActive" = true
            LIMIT 1
        `;
        const doc = docs[0];
        if (!doc) return NextResponse.json({ error: 'Document not found' }, { status: 404 });

        const candidates = await db.$queryRaw<Array<{ clientId: string; latestVersion: string }>>`
            WITH same_type_docs AS (
                SELECT id FROM "PsychologistClientDocument"
                WHERE "psychologistId" = ${psychologistId} AND type = ${doc.type}
            ), ranked AS (
                SELECT d."clientId", d."documentVersion" as "latestVersion",
                       ROW_NUMBER() OVER (PARTITION BY d."clientId" ORDER BY d."sentAt" DESC, d."createdAt" DESC) as rn
                FROM "ClientDocumentDelivery" d
                WHERE d."psychologistId" = ${psychologistId}
                  AND d."documentId" IN (SELECT id FROM same_type_docs)
                  AND (${clientIds.length}::int = 0 OR d."clientId" = ANY(${clientIds}::text[]))
            )
            SELECT "clientId", "latestVersion"
            FROM ranked
            WHERE rn = 1 AND "latestVersion" <> ${doc.version}
        `;

        const deliveries = [];
        for (const candidate of candidates) {
            deliveries.push(await createClientDocumentDelivery({
                psychologistId,
                clientId: candidate.clientId,
                documentId,
                channel: 'manual',
                recipientContact: null,
            }));
        }

        return NextResponse.json({ success: true, count: deliveries.length, deliveries });
    } catch (error) {
        console.error('[diary/documents/resend-outdated POST]', error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
