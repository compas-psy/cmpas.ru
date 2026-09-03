import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { createNotification } from '@/lib/notifications';
import { requirePracticeOperatorAttestation, ATTESTATION_REQUIRED_CODE } from '@/lib/practice/attestation';

function normalName(value: string) {
    return value.trim().replace(/\s+/g, ' ').slice(0, 120) || 'Клиент из календаря';
}

export async function POST(req: NextRequest) {
    const session = await auth();
    const psychologistId = session?.user?.id;
    if (!psychologistId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const body = await req.json();
        const items = Array.isArray(body.items) ? body.items : [];
        if (!items.length) return NextResponse.json({ imported: 0, skipped: 0 });

        await requirePracticeOperatorAttestation(psychologistId);

        let imported = 0;
        let skipped = 0;
        const importedIds: string[] = [];

        for (const raw of items.slice(0, 100)) {
            const clientName = normalName(String(raw.clientName || raw.summary || 'Клиент из календаря'));
            const date = String(raw.date || '');
            const startTime = String(raw.startTime || '');
            const endTime = String(raw.endTime || '');
            const duration = Number(raw.duration || 50);
            if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(startTime)) {
                skipped += 1;
                continue;
            }

            const dayStart = new Date(date); dayStart.setHours(0, 0, 0, 0);
            const dayEnd = new Date(date); dayEnd.setHours(23, 59, 59, 999);
            const existingClient = await db.diaryClient.findFirst({
                where: { psychologistId, name: { equals: clientName, mode: 'insensitive' } },
            });
            const client = existingClient || await db.diaryClient.create({
                data: { psychologistId, name: clientName, status: 'active' },
            });

            const duplicate = await db.diarySession.findFirst({
                where: {
                    psychologistId,
                    clientId: client.id,
                    date: { gte: dayStart, lte: dayEnd },
                    time: startTime,
                    status: { not: 'cancelled' },
                },
            });
            if (duplicate) {
                skipped += 1;
                continue;
            }

            const created = await db.diarySession.create({
                data: {
                    psychologistId,
                    clientId: client.id,
                    date: dayStart,
                    time: startTime,
                    endTime: /^\d{2}:\d{2}$/.test(endTime) ? endTime : null,
                    duration: Number.isFinite(duration) ? duration : 50,
                    type: 'individual',
                    format: 'online',
                    status: 'pending',
                    notes: String(raw.summary || '').trim() || null,
                },
            });
            importedIds.push(created.id);
            imported += 1;
        }

        if (imported > 0) {
            await createNotification({
                psychologistId,
                type: 'calendar_imported',
                title: 'Календарь импортирован',
                subtitle: `Добавлено встреч: ${imported}. Пропущено дублей: ${skipped}.`,
            });
        }

        return NextResponse.json({ imported, skipped, sessionIds: importedIds });
    } catch (error) {
        if (error instanceof Error && error.message === ATTESTATION_REQUIRED_CODE) {
            return NextResponse.json({ error: ATTESTATION_REQUIRED_CODE }, { status: 403 });
        }
        console.error('[calendar/import/apply POST]', error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
