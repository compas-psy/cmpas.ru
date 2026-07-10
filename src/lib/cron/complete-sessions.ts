/**
 * COMPLETE-1: переводит `confirmed` сессии, которые фактически закончились
 * (date+endTime < now-15мин), в `completed`. `pending` не трогаем — это
 * забота психолога подтвердить или отменить. Если заметок нет — мягкий
 * нудж психологу через createNotification.
 */
import { db } from '@/lib/db';
import { createNotification } from '@/lib/notifications';

const GRACE_MS = 15 * 60 * 1000;

export async function processSessionAutoComplete() {
    try {
        const now = new Date();
        const dayStart = new Date(now);
        dayStart.setDate(now.getDate() - 2); // sessions can't run >48h, bounds the scan

        const candidates = await db.diarySession.findMany({
            where: {
                status: 'confirmed',
                date: { gte: dayStart, lte: now },
            },
            include: { client: { select: { id: true, name: true } } },
        });

        for (const session of candidates) {
            const [h, m] = (session.endTime || session.time).split(':').map(Number);
            const sessionEnd = new Date(session.date);
            sessionEnd.setHours(h || 0, m || 0, 0, 0);

            if (now.getTime() - sessionEnd.getTime() < GRACE_MS) continue;

            await db.diarySession.update({
                where: { id: session.id },
                data: { status: 'completed' },
            });

            const hasNotes = Boolean(session.notes) || Boolean(session.structuredNotes);
            if (!hasNotes) {
                await createNotification({
                    psychologistId: session.psychologistId,
                    type: 'session_needs_note',
                    title: `Сессия с ${session.client?.name || 'клиентом'} завершена`,
                    subtitle: 'Самое время для заметки — если будет удобно',
                    sessionId: session.id,
                    clientId: session.clientId,
                });
            }
        }
    } catch (error) {
        console.error('[processSessionAutoComplete] Error:', error);
    }
}
