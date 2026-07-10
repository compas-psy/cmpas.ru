import { randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { authenticateMobileRequest, unauthorizedResponse } from '@/lib/mobile-auth';
import { getActiveLegalDocuments, LEGAL_DOC_TYPES, REQUIRED_LEGAL_DOC_TYPES } from '@/lib/legal-documents';

type ActiveLegalDocument = Awaited<ReturnType<typeof getActiveLegalDocuments>>[number];

function clientIp(req: NextRequest) {
    return req.headers.get('x-real-ip')
        || req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
        || 'unknown';
}

async function writeBaseAcceptance(params: {
    userId: string;
    document: ActiveLegalDocument;
    ipAddress: string;
}) {
    const { userId, document, ipAddress } = params;
    await db.$executeRaw(Prisma.sql`
        INSERT INTO "LegalDocumentAcceptance"
            (id, "userId", "documentId", "acceptedAt", "ipAddress")
        VALUES
            (${randomUUID()}, ${userId}, ${document.id}, NOW(), ${ipAddress})
        ON CONFLICT ("userId", "documentId") DO UPDATE
        SET "acceptedAt" = EXCLUDED."acceptedAt",
            "ipAddress" = EXCLUDED."ipAddress"
    `);
}

async function ensureAuditColumns() {
    try {
        await db.$executeRaw(Prisma.sql`
            ALTER TABLE "LegalDocumentAcceptance" ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'web'
        `);
        await db.$executeRaw(Prisma.sql`
            ALTER TABLE "LegalDocumentAcceptance" ADD COLUMN IF NOT EXISTS "documentType" TEXT
        `);
        await db.$executeRaw(Prisma.sql`
            ALTER TABLE "LegalDocumentAcceptance" ADD COLUMN IF NOT EXISTS "documentVersion" TEXT
        `);
        return true;
    } catch (error) {
        // Acceptance uses the stable base columns and remains valid even if the
        // deployment role cannot perform DDL. Migration/deploy must still fix
        // audit fields before external beta.
        console.error('[mobile/legal/accept] audit columns unavailable', error);
        return false;
    }
}

async function updateAuditSnapshot(params: {
    userId: string;
    document: ActiveLegalDocument;
    source: string;
}) {
    const { userId, document, source } = params;
    await db.$executeRaw(Prisma.sql`
        UPDATE "LegalDocumentAcceptance"
        SET source = ${source},
            "documentType" = ${document.type},
            "documentVersion" = ${document.version}
        WHERE "userId" = ${userId} AND "documentId" = ${document.id}
    `);
}

export async function POST(req: NextRequest) {
    const auth = await authenticateMobileRequest(req);
    if (!auth) return unauthorizedResponse();

    const body = await req.json().catch(() => ({}));
    const ipAddress = clientIp(req);

    try {
        const activeDocs = await getActiveLegalDocuments(LEGAL_DOC_TYPES);
        const requiredDocs = activeDocs.filter((doc) => REQUIRED_LEGAL_DOC_TYPES.some((type) => type === doc.type));
        const adsDoc = activeDocs.find((doc) => doc.type === 'ADS') ?? null;

        if (body.acceptTerms === true) {
            if (requiredDocs.length !== REQUIRED_LEGAL_DOC_TYPES.length) {
                return NextResponse.json({ error: 'Required legal documents are unavailable' }, { status: 503 });
            }

            await db.$transaction(
                requiredDocs.map((document) => db.$executeRaw(Prisma.sql`
                    INSERT INTO "LegalDocumentAcceptance"
                        (id, "userId", "documentId", "acceptedAt", "ipAddress")
                    VALUES
                        (${randomUUID()}, ${auth.userId}, ${document.id}, NOW(), ${ipAddress})
                    ON CONFLICT ("userId", "documentId") DO UPDATE
                    SET "acceptedAt" = EXCLUDED."acceptedAt",
                        "ipAddress" = EXCLUDED."ipAddress"
                `)),
            );

            if (await ensureAuditColumns()) {
                for (const document of requiredDocs) {
                    await updateAuditSnapshot({ userId: auth.userId, document, source: 'android' });
                }
            }
        }

        let adsAccepted: boolean | null = null;
        if (body.acceptAds === true) {
            if (!adsDoc) {
                return NextResponse.json({ error: 'Advertising consent document is unavailable' }, { status: 503 });
            }
            await writeBaseAcceptance({ userId: auth.userId, document: adsDoc, ipAddress });
            if (await ensureAuditColumns()) {
                await updateAuditSnapshot({ userId: auth.userId, document: adsDoc, source: 'android' });
            }
            adsAccepted = true;
        } else if (body.acceptAds === false && adsDoc) {
            await db.legalDocumentAcceptance.deleteMany({ where: { userId: auth.userId, documentId: adsDoc.id } });
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
