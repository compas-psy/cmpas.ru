import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateMobileRequest, unauthorizedResponse } from '@/lib/mobile-auth';
import { autoSyncSessionToCalendars } from '@/lib/calendar/auto-sync';
import { OwnershipError, requireOwnedClient } from '@/lib/practice/ownership';
import { repeatClientSlot, NoReferenceSessionError, MAX_REPEAT_WEEKS } from '@/lib/practice/booking/repeat-slot';
import { notifyClientAboutSession } from '@/lib/practice/session-notice';
import { track } from '@/lib/analytics/track';

/**
 * «Тот же час через неделю» и «занять слот на срок» из карточки клиента в
 * приложении — тем же ядром, что и в вебе (src/lib/practice/booking/repeat-slot.ts).
 *
 * Ответ — поимённый отчёт, а не «готово»: если какая-то неделя занята,
 * остальные всё равно записаны, и приложение показывает, какая дата выпала.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const auth = await authenticateMobileRequest(req);
    if (!auth) return unauthorizedResponse();
    const { id: clientId } = await params;

    try {
        await requireOwnedClient(auth.userId, clientId);

        const body = await req.json().catch(() => ({}));
        const weeks = Number(body.weeks);
        if (!Number.isFinite(weeks) || weeks < 1 || weeks > MAX_REPEAT_WEEKS) {
            return NextResponse.json({ error: `weeks must be between 1 and ${MAX_REPEAT_WEEKS}` }, { status: 400 });
        }

        const result = await repeatClientSlot({ psychologistId: auth.userId, clientId, weeks });

        if (result.booked.length > 0) {
            const totalSessions = await db.diarySession.count({ where: { clientId } });
            const nextSession = await db.diarySession.findFirst({
                where: { clientId, date: { gte: new Date() }, status: { in: ['confirmed', 'pending'] } },
                orderBy: { date: 'asc' },
            });
            await db.diaryClient.update({
                where: { id: clientId },
                data: { totalSessions, nextSessionDate: nextSession?.date || null },
            });

            for (const item of result.booked) {
                const full = await db.diarySession.findUnique({
                    where: { id: item.sessionId },
                    include: { client: { select: { name: true } } },
                });
                if (full) autoSyncSessionToCalendars(auth.userId, full as never).catch(console.error);
            }

            // Одно сообщение — про ближайшую встречу. Двенадцать сообщений о
            // занятом квартале человеку ни к чему, а про ближайшую он должен
            // знать так же, как при обычной записи.
            await notifyClientAboutSession(auth.userId, result.booked[0].sessionId, totalSessions === 1)
                .catch((error) => console.error('[mobile/clients/id/repeat-slot] notice failed:', error));
        }

        await track(db, {
            event: 'session_slot_repeated',
            product: 'practice',
            accountId: auth.userId,
            props: { weeks_requested: weeks, booked: result.booked.length, skipped: result.skipped.length },
        }).catch(() => undefined);

        return NextResponse.json(result, { status: 201 });
    } catch (error) {
        if (error instanceof NoReferenceSessionError) {
            return NextResponse.json({ error: error.message }, { status: 409 });
        }
        if (error instanceof OwnershipError) {
            return NextResponse.json({ error: 'Not found' }, { status: 404 });
        }
        console.error('[mobile/clients/id/repeat-slot POST]', error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
