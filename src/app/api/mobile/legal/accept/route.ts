import { randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { authenticateMobileRequest, unauthorizedResponse } from '@/lib/mobile-auth';
import { getActiveLegalDocuments, LEGAL_DOC_TYPES, ACCOUNT_REQUIRED_TYPES } from '@/lib/legal-documents';

type ActiveLegalDocument = Awaited<ReturnType<typeof getActiveLegalDocuments>>[number];

function clientIp(req: NextRequest) {
    return req.headers.get('x-real-ip')
        || req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
        || 'unknown';
}

function acceptanceUpsert(params: {
    userId: string;
    document: ActiveLegalDocument;
    ipAddress: string;
    source: string;
}) {
    const { userId, document, ipAddress, source } = params;
    return Prisma.sql`
        INSERT INTO "LegalDocumentAcceptance"
            (id, "userId", "documentId", "acceptedAt", "ipAddress", "source", "documentType", "documentVersion", "documentCode")
        VALUES
            (${randomUUID()}, ${userId}, ${document.id}, NOW(), ${ipAddress}, ${source}, ${document.type}, ${document.version}, ${document.code})
        ON CONFLICT ("userId", "documentId") DO UPDATE
        SET "acceptedAt" = EXCLUDED."acceptedAt",
            "ipAddress" = EXCLUDED."ipAddress",
            "source" = EXCLUDED."source",
            "documentType" = EXCLUDED."documentType",
            "documentVersion" = EXCLUDED."documentVersion",
            "documentCode" = EXCLUDED."documentCode"
    `;
}

export async function POST(req: NextRequest) {
    const auth = await authenticateMobileRequest(req);
    if (!auth) return unauthorizedResponse();

    const body = await req.json().catch(() => ({}));
    const ipAddress = clientIp(req);

    try {
        const activeDocs = await getActiveLegalDocuments(LEGAL_DOC_TYPES);
        const requiredDocs = ACCOUNT_REQUIRED_TYPES
            .map((type) => activeDocs.find((doc) => doc.type === type))
            .filter((doc): doc is ActiveLegalDocument => Boolean(doc));
        const adsDoc = activeDocs.find((doc) => doc.type === 'ADS') ?? null;

        if (body.acceptTerms === true) {
            if (requiredDocs.length !== ACCOUNT_REQUIRED_TYPES.length) {
                return NextResponse.json({ error: 'Required legal documents are unavailable' }, { status: 503 });
            }

            await db.$transaction(
                requiredDocs.map((document) => db.$executeRaw(acceptanceUpsert({
                    userId: auth.userId,
                    document,
                    ipAddress,
                    source: 'android',
                }))),
            );
        }

        let adsAccepted: boolean | null = null;
        if (body.acceptAds === true) {
            if (!adsDoc) {
                return NextResponse.json({ error: 'Advertising consent document is unavailable' }, { status: 503 });
            }
            await db.$executeRaw(acceptanceUpsert({
                userId: auth.userId,
                document: adsDoc,
                ipAddress,
                source: 'android',
            }));
            adsAccepted = true;
        } else if (body.acceptAds === false && adsDoc) {
            await db.legalDocumentAcceptance.deleteMany({
                where: { userId: auth.userId, documentId: adsDoc.id },
            });
            adsAccepted = false;
        }

        return NextResponse.json({
            success: true,
            requiredAccepted: body.acceptTerms === true,
            adsAccepted,
        });
    } catch (error) {
        console.error('mobile legal accept failed', error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
