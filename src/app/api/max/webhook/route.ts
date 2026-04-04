import { NextRequest, NextResponse } from 'next/server';
import { handleMaxUpdate } from '@/lib/max-bot';

export async function POST(request: NextRequest) {
    if (!process.env.MAX_BOT_TOKEN) {
        return NextResponse.json({ error: 'MAX bot not configured' }, { status: 500 });
    }

    try {
        // MAX sends individual update objects
        const update = await request.json();
        await handleMaxUpdate(update);
        return NextResponse.json({ ok: true });
    } catch (error) {
        console.error('[MAX webhook]:', error);
        return NextResponse.json({ error: 'Failed to process update' }, { status: 500 });
    }
}

export async function GET() {
    return NextResponse.json({ status: 'MAX webhook active' });
}
