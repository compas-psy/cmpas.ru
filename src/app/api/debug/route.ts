import { getAvailableDates, getAvailableTimes } from '@/app/bot/actions';
import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const psycho = await db.user.findFirst({ where: { role: 'psychologist' } });
        if (!psycho) return NextResponse.json({ error: 'no psycho' });

        const dates = await getAvailableDates(psycho.id, 2026, 2, true); // March 2026
        const times = await getAvailableTimes(psycho.id, '2026-03-12', true);

        return NextResponse.json({ success: true, psycho: psycho.id, dates, times });
    } catch (e: any) {
        return NextResponse.json({ success: false, error: e.message, stack: e.stack });
    }
}
