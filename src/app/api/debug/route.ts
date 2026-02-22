import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    const user = await db.user.findUnique({ where: { email: 'eliah@yandex.ru' } })
    if (!user) return NextResponse.json({ error: "Not found" });
    const slots = await db.availabilitySlot.findMany({ where: { psychologistId: user.id } })
    const blocks = await db.timeBlock.findMany({ where: { psychologistId: user.id } })
    return NextResponse.json({ slots, blocks });
}
