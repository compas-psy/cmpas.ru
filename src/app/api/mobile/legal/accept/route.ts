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
            if (ads) ids.add(ads.id);
        }

        if (ids.size > 0) {
            const ipAddress = req.headers.get('x-real-ip') || req.headers.get('x-forwarded-for') || 'unknown';
            await db.legalDocumentAcceptance.createMany({
                data: [...ids].map((documentId) => ({ userId: auth.userId, documentId, ipAddress })),
                skipDuplicates: true,
            });
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
