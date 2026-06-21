import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateMobileRequest, unauthorizedResponse } from '@/lib/mobile-auth';

async function activeDocument(type: string) {
    return db.legalDocument.findFirst({
        where: { isActive: true, type },
        orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
    });
}

export async function POST(req: NextRequest) {
    const auth = await authenticateMobileRequest(req);
    if (!auth) return unauthorizedResponse();

    try {
        const body = await req.json().catch(() => ({}));
        const ids = new Set<string>();

        if (Array.isArray(body.documentIds)) {
            for (const value of body.documentIds) {
                if (typeof value === 'string') ids.add(value);
            }
        }

        if (body.acceptTerms === true) {
            const terms = await activeDocument('TERMS');
            const privacy = await activeDocument('PRIVACY');
            if (terms) ids.add(terms.id);
            if (privacy) ids.add(privacy.id);
        }

        if (body.acceptAds === true) {
            const ads = await activeDocument('ADS');
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
            const ads = await activeDocument('ADS');
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
