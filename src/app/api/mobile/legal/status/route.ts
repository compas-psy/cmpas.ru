import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateMobileRequest, unauthorizedResponse } from '@/lib/mobile-auth';

const MOBILE_LEGAL_TYPES = ['TERMS', 'PRIVACY', 'ADS'];
const REQUIRED_LEGAL_TYPES = ['TERMS', 'PRIVACY'];

export async function GET(req: NextRequest) {
    const auth = await authenticateMobileRequest(req);
    if (!auth) return unauthorizedResponse();

    try {
        const documents = await db.legalDocument.findMany({
            where: { isActive: true, type: { in: MOBILE_LEGAL_TYPES } },
            orderBy: [{ type: 'asc' }, { publishedAt: 'desc' }, { createdAt: 'desc' }],
        });

        const acceptances = documents.length
            ? await db.legalDocumentAcceptance.findMany({
                where: { userId: auth.userId, documentId: { in: documents.map((doc) => doc.id) } },
                select: { documentId: true },
            })
            : [];

        const acceptedIds = new Set(acceptances.map((acceptance) => acceptance.documentId));
        const latestByType = (type: string) => documents.find((doc) => doc.type === type) ?? null;
        const normalize = (doc: typeof documents[number] | null) => doc ? ({
            id: doc.id,
            type: doc.type,
            version: doc.version,
            url: doc.url,
            publishedAt: doc.publishedAt?.toISOString() ?? null,
            accepted: acceptedIds.has(doc.id),
        }) : null;

        const requiredDocuments = REQUIRED_LEGAL_TYPES
            .map((type) => latestByType(type))
            .filter((doc): doc is NonNullable<typeof doc> => !!doc && !acceptedIds.has(doc.id));

        return NextResponse.json({
            serverTime: new Date().toISOString(),
            requiredDocumentIds: requiredDocuments.map((doc) => doc.id),
            requiresTermsAcceptance: requiredDocuments.length > 0,
            terms: normalize(latestByType('TERMS')),
            privacy: normalize(latestByType('PRIVACY')),
            ads: normalize(latestByType('ADS')),
            adsAccepted: !!latestByType('ADS') && acceptedIds.has(latestByType('ADS')!.id),
        });
    } catch (error) {
        console.error('mobile legal status failed', error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
