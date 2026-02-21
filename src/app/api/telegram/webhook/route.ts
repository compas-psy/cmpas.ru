import { NextRequest, NextResponse } from 'next/server';
import { bot } from '@/lib/telegram-bot';

export async function POST(request: NextRequest) {
    if (!bot) {
        return NextResponse.json({ error: 'Telegram bot not configured' }, { status: 500 });
    }

    try {
        const body = await request.json();

        // Let telegraf handle the update
        await bot.handleUpdate(body);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Telegram webhook error:', error);
        return NextResponse.json({ error: 'Failed to process update' }, { status: 500 });
    }
}

// Explicit export to prevent Next.js from complaining about no GET handler if accessed directly in dev
export async function GET() {
    return NextResponse.json({ status: 'Webhook endpoint active' });
}
