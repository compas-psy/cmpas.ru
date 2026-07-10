import { randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateMobileRequest, unauthorizedResponse } from '@/lib/mobile-auth';

const ALLOWED_FEATURES = new Set([
    'voice_transcription_summary',
    'previous_notes_digest',
    'smart_slots',
    'ai_notes_assistant',
]);

function normalizeFeature(value: unknown) {
    if (typeof value !== 'string') return null;
    const feature = value.trim().toLowerCase();
    if (!feature || feature.length > 80) return null;
    return feature;
}

export async function POST(req: NextRequest) {
    const auth = await authenticateMobileRequest(req);
    if (!auth) return unauthorizedResponse();

    try {
        const body = await req.json().catch(() => ({}));
        const feature = normalizeFeature(body.feature);
        if (!feature) {
            return NextResponse.json({ error: 'feature is required' }, { status: 400 });
        }
        if (!ALLOWED_FEATURES.has(feature)) {
            return NextResponse.json({ error: 'unknown feature' }, { status: 400 });
        }

        await db.$executeRaw`
            INSERT INTO "FeatureInterest" (id, "userId", feature, source, "createdAt")
            VALUES (${randomUUID()}, ${auth.userId}, ${feature}, 'android', NOW())
            ON CONFLICT ("userId", feature) DO NOTHING
        `;

        const rows = await db.$queryRaw<Array<{ count: bigint }>>`
            SELECT COUNT(*)::bigint AS count FROM "FeatureInterest" WHERE feature = ${feature}
        `;

        return NextResponse.json({ success: true, feature, alreadyInList: true, count: Number(rows[0]?.count || 0) });
    } catch (error) {
        console.error('[mobile/feature-interest POST]', error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
