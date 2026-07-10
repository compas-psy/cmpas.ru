import { randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateMobileRequest, unauthorizedResponse } from '@/lib/mobile-auth';
import { getActiveLegalDocument, getActiveLegalDocuments, LEGAL_DOC_TYPES } from '@/lib/legal-documents';

export async function POST(req: NextRequest) {
    const auth = await authenticateMobileRequest(req);
    if (!auth) return unauthorizedResponse();

    try {
        const body = await req.json().catch(() => ({}));
        const ids = new Set<string>();
        const activeDocs = await getActiveLegalDocuments(LEGAL_DOC_TYPES);
        const docsById = new Map(activeDocs.map((doc) => [doc.id, doc]));
        const activeDocIds = new Set(activeDocs.map((doc) => doc.id));

        if (Array.isArray(body.documentIds)) {
            for (const value of body.documentIds) {
                if (typeof value === 'string' && activeDocIds.has(value)) ids.add(value);
            }
        }

        if (body.acceptTerms === true) {
            for (const doc of activeDocs) {
                if (doc.type === 'TERMS' || doc.type === 'PRIVACY') ids.add(doc.id);
            }
        }

        if (body.acceptAds === true) {
            const ads = await getActiveLegalDocument('ADS');
            if (ads) {
                ids.add(ads.id);
                docsById.set(ads.id, ads);
            }
        }

        if (ids.size > 0) {
            const ipAddress = req.headers.get('x-real-ip') || req.headers.get('x-forwarded-for') || 'unknown';
            for (const documentId of ids) {
                const doc = docsById.get(documentId);
                if (!doc) continue;
                await db.$executeRaw`
                    INSERT INTO "LegalDocumentAcceptance" (id, "userId", "documentId", "acceptedAt", "ipAddress", source, "documentType", "documentVersion")
                    VALUES (${randomUUID()}, ${auth.userId}, ${documentId}, NOW(), ${ipAddress}, 'android', ${doc.type}, ${doc.version})
                    ON CONFLICT ("userId", "documentId") DO UPDATE
                    SET source = EXCLUDED.source,
                        "documentType" = COALESCE("LegalDocumentAcceptance"."documentType", EXCLUDED."documentType"),
                        "documentVersion" = COALESCE("LegalDocumentAcceptance"."documentVersion", EXCLUDED."documentVersion")
                `;
            }
        }

        if (body.acceptAds === false) {
            const ads = await getActiveLegalDocument('ADS');
            if (ads) {
                await db.legalDocumentAcceptance.deleteMany({ where: { userId: auth.userId, documentId: ads.id } });
            }
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('mobile legal accept failed', error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
