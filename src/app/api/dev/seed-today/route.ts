'use server';

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { auth } from '@/auth';

export async function POST() {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const psychologistId = session.user.id;

    // Get existing clients
    const clients = await db.diaryClient.findMany({
        where: { psychologistId },
        take: 4,
        orderBy: { createdAt: 'asc' },
    });

    if (clients.length === 0) {
        return NextResponse.json({ error: 'No clients found' }, { status: 400 });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Check if sessions already exist today
    const todayEnd = new Date(today);
    todayEnd.setHours(23, 59, 59, 999);
    const existing = await db.diarySession.count({
        where: { psychologistId, date: { gte: today, lte: todayEnd }, status: { not: 'cancelled' } },
    });
    if (existing > 0) {
        return NextResponse.json({ message: `Already ${existing} sessions today`, skipped: true });
    }

    // Create 3-4 sessions spread across the rest of the day
    const now = new Date();
    const currentHour = now.getHours();
    const sessions = [
        { time: `${String(Math.max(currentHour + 1, 11)).padStart(2, '0')}:00`, duration: 50, type: 'individual', format: 'online' },
        { time: `${String(Math.max(currentHour + 2, 13)).padStart(2, '0')}:00`, duration: 50, type: 'couple', format: 'offline' },
        { time: `${String(Math.max(currentHour + 3, 15)).padStart(2, '0')}:15`, duration: 60, type: 'individual', format: 'online' },
    ];

    if (clients.length >= 4) {
        sessions.push({
            time: `${String(Math.max(currentHour + 4, 16)).padStart(2, '0')}:30`,
            duration: 50,
            type: 'family',
            format: 'online',
        });
    }

    const created = [];
    for (let i = 0; i < Math.min(sessions.length, clients.length); i++) {
        const s = sessions[i];
        const [h, m] = s.time.split(':').map(Number);
        const endMinutes = h * 60 + m + s.duration;
        const endTime = `${String(Math.floor(endMinutes / 60)).padStart(2, '0')}:${String(endMinutes % 60).padStart(2, '0')}`;

        const sess = await db.diarySession.create({
            data: {
                psychologistId,
                clientId: clients[i].id,
                date: today,
                time: s.time,
                endTime,
                duration: s.duration,
                type: s.type,
                format: s.format,
                status: 'confirmed',
            },
        });
        created.push(sess);
    }

    return NextResponse.json({ success: true, created: created.length, sessions: created.map(s => ({ id: s.id, time: s.time, endTime: s.endTime })) });
}
