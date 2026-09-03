import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateMobileRequest, unauthorizedResponse } from '@/lib/mobile-auth';
import { getActiveLegalDocuments, LEGAL_DOC_TYPES, publicLegalDocUrl, ACCOUNT_REQUIRED_TYPES } from '@/lib/legal-documents';

export async function GET(req: NextRequest) {
    const auth = await authenticateMobileRequest(req);
    if (!auth) return unauthorizedResponse();

    try {
        const documents = await getActiveLegalDocuments(LEGAL_DOC_TYPES);

        const acceptances = await db.legalDocumentAcceptance.findMany({
            where: { userId: auth.userId, documentId: { in: documents.map((doc) => doc.id) } },
            select: { documentId: true },
        });

        const acceptedIds = new Set(acceptances.map((acceptance) => acceptance.documentId));
        const latestByType = (type: string) => documents.find((doc) => doc.type === type) ?? null;
        const normalize = (doc: typeof documents[number] | null) => doc ? ({
            id: doc.id,
            type: doc.type,
            version: doc.version,
            url: publicLegalDocUrl(doc.url),
            publishedAt: doc.publishedAt?.toISOString() ?? null,
            accepted: acceptedIds.has(doc.id),
        }) : null;

        const requiredDocuments = ACCOUNT_REQUIRED_TYPES
            .map((type) => latestByType(type))
            .filter((doc): doc is NonNullable<typeof doc> => !!doc && !acceptedIds.has(doc.id));

        // Marketing consent lives in ConsentEvent (grant/revoke history), not
        // LegalDocumentAcceptance — see Task 5 / src/app/legal/actions.ts.
        const latestMarketingEvent = await db.consentEvent.findFirst({
            where: { userId: auth.userId, consentType: 'marketing', channel: 'all' },
            orderBy: { occurredAt: 'desc' },
        });
        const adsAccepted = latestMarketingEvent?.status === 'granted';
        const adsDoc = latestByType('ADS');

        return NextResponse.json({
            serverTime: new Date().toISOString(),
            requiredDocumentIds: requiredDocuments.map((doc) => doc.id),
            requiresTermsAcceptance: requiredDocuments.length > 0,
            terms: normalize(latestByType('TERMS')),
            privacy: normalize(latestByType('PRIVACY')),
            ads: adsDoc ? { ...normalize(adsDoc), accepted: adsAccepted } : null,
            adsAccepted,
        });
    } catch (error) {
        console.error('mobile legal status failed', error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
