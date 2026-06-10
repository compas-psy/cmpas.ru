import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateMobileRequest, unauthorizedResponse } from '@/lib/mobile-auth';

/**
 * GET /api/mobile/blocks?from=YYYY-MM-DD&to=YYYY-MM-DD
 * Returns time blocks (unavailability) for the given range.
 */
export async function GET(req: NextRequest) {
    const auth = await authenticateMobileRequest(req);
    if (!auth) return unauthorizedResponse();

    const from = req.nextUrl.searchParams.get('from');
    const to = req.nextUrl.searchParams.get('to');

    try {
        const blocks = await db.diaryBlock.findMany({
            where: {
                psychologistId: auth.userId,
                ...(from && to && {
                    date: { gte: new Date(from), lte: new Date(to) },
                }),
            },
            orderBy: { date: 'asc' },
        });

        return NextResponse.json(blocks.map(b => ({
            id: b.id,
            date: b.date.toISOString().split('T')[0],
            startTime: b.startTime || '00:00',
            endTime: b.endTime || '23:59',
            type: b.type || 'block',
            reason: b.reason || null,
        })));
    } catch (error) {
        console.error('[mobile/blocks GET]', error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}

/**
 * POST /api/mobile/blocks
 * Create a time block (vacation, sick, personal, etc.).
 * Body: { startDate, endDate, type, reason?, cancelIntersectingSessions? }
 */
export async function POST(req: NextRequest) {
    const auth = await authenticateMobileRequest(req);
    if (!auth) return unauthorizedResponse();

    try {
        const { startDate, endDate, type, reason, cancelIntersectingSessions } = await req.json();

        if (!startDate || !type) {
            return NextResponse.json({ error: 'startDate and type required' }, { status: 400 });
        }

        const start = new Date(startDate);
        const end = new Date(endDate || startDate);

        const blocksToCreate = [];
        for (const d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            blocksToCreate.push({
                psychologistId: auth.userId,
                date: new Date(d),
                startTime: '00:00',
                endTime: '23:59',
                type,
                reason: reason || null,
            });
        }

        await db.diaryBlock.createMany({ data: blocksToCreate });

        if (cancelIntersectingSessions) {
            const sessionsToCancel = await db.diarySession.findMany({
                where: {
                    psychologistId: auth.userId,
                    date: { gte: start, lte: end },
                    status: { notIn: ['cancelled', 'completed'] },
                },
                include: { client: true },
            });
            if (sessionsToCancel.length > 0) {
                await db.diarySession.updateMany({
                    where: { id: { in: sessionsToCancel.map(s => s.id) } },
                    data: { status: 'cancelled' },
                });
                for (const s of sessionsToCancel) {
                    const client = s.client as any;
                    const msg = `⚠️ Ваша запись на ${s.date.toLocaleDateString('ru-RU')} в ${s.time} была отменена${reason ? ` (${reason})` : ''}. Свяжитесь для переноса.`;
                    try {
                        if (client?.telegramChatId) {
                            const { sendTelegramMessage } = await import('@/lib/telegram');
                            await sendTelegramMessage(client.telegramChatId, msg);
                        } else if (client?.maxChatId) {
                            const { sendMaxMessage } = await import('@/lib/max-bot');
                            await sendMaxMessage(client.maxChatId, msg);
                        }
                    } catch { /* ignore */ }
                }
            }
        }

        return NextResponse.json({ ok: true, created: blocksToCreate.length }, { status: 201 });
    } catch (error) {
        console.error('[mobile/blocks POST]', error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
