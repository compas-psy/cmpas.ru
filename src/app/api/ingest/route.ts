import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { isIngestEnabled } from '@/lib/analytics/flags';
import { processIngestEvent } from '@/lib/analytics/ingest';

export async function POST(request: NextRequest) {
    if (!isIngestEnabled()) {
        return new NextResponse('Not Found', { status: 404 });
    }

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
        return NextResponse.json({ accepted: false, reason: 'invalid JSON body' }, { status: 400 });
    }

    const result = await processIngestEvent(db, body);
    return NextResponse.json(result);
}
