import { NextRequest, NextResponse } from 'next/server';
import { maxBot } from '@/lib/max-bot';

export async function POST(request: NextRequest) {
    if (!maxBot) {
        return NextResponse.json({ error: 'MAX bot not configured' }, { status: 500 });
    }

    try {
        const body = await request.json();
        await maxBot.handleUpdate(body);
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('[MAX webhook error]:', error);
        return NextResponse.json({ error: 'Failed to process update' }, { status: 500 });
    }
}

export async function GET() {
    return NextResponse.json({ status: 'MAX webhook endpoint active' });
}
