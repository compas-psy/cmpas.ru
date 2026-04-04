/**
 * Verifies the MAX connect link signature server-side.
 * Called by the /diary/max-connect client page.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createHmac } from 'crypto';

const LINK_SECRET = process.env.MAX_LINK_SECRET || process.env.AUTH_SECRET || 'fallback-secret';

export async function POST(request: NextRequest) {
    const { mid, exp, sig } = await request.json();

    if (!mid || !exp || !sig) {
        return NextResponse.json({ valid: false });
    }

    const payload = `${mid}:${exp}`;
    const expected = createHmac('sha256', LINK_SECRET).update(payload).digest('hex');

    return NextResponse.json({ valid: expected === sig });
}
