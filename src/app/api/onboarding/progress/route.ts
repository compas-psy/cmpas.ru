import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db';

export async function GET() {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const psychologistId = session.user.id;

    const [clientsCount, availabilityCount, botUser] = await Promise.all([
        db.diaryClient.count({ where: { psychologistId } }),
        db.availabilitySlot.count({ where: { psychologistId, isActive: true } }),
        db.user.findUnique({
            where: { id: psychologistId },
            select: { telegramChatId: true, maxChatId: true },
        }),
    ]);

    const botConnected = !!(botUser?.telegramChatId || botUser?.maxChatId);

    return NextResponse.json({
        clientsCount,
        availabilityCount,
        botConnected,
    });
}
