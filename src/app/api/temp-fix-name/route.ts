import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
    try {
        const user = await db.user.findFirst({ where: { name: 'eliah' } });
        if (!user) return NextResponse.json({ error: 'User eliah not found' });

        const settings = await db.psychologistSettings.upsert({
            where: { psychologistId: user.id },
            update: { fullName: 'Илья Мартынов' },
            create: { psychologistId: user.id, fullName: 'Илья Мартынов' }
        });

        return NextResponse.json({ success: true, settings });
    } catch (e: any) {
        return NextResponse.json({ error: e.message });
    }
}
