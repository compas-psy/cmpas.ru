import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateMobileRequest, unauthorizedResponse } from '@/lib/mobile-auth';

// Границы календарного дня берутся в UTC, а не через setHours.
//
// DiaryBlock.date — это календарный день, привязанный к полуночи UTC, и
// именно так его читает резолвер доступности (toDateStr → toISOString), см.
// src/lib/practice/booking/availability.ts и src/lib/practice/migration/
// date-utils.ts. `new Date('YYYY-MM-DD')` даёт полночь UTC, но setHours
// пишет через часовой пояс ОС сервера: стоит контейнеру подняться не в UTC —
// и блокировка сохранится на соседний день, то есть перестанет закрывать то
// время, ради которого её поставили. Сегодня сервер в UTC и поведение то же;
// это снятая мина, а не смена поведения.
function dayStart(value: string) {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return parsed;
    return new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate()));
}

function dayEnd(value: string) {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return parsed;
    return new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate(), 23, 59, 59, 999));
}

function normalizeTime(value: unknown, fallback: string) {
    if (typeof value !== 'string') return fallback;
    const trimmed = value.trim();
    return /^\d{2}:\d{2}$/.test(trimmed) ? trimmed : fallback;
}

function minutesOf(value: string) {
    const [hours, minutes] = value.split(':').map(Number);
    return hours * 60 + minutes;
}

function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string) {
    return minutesOf(aStart) < minutesOf(bEnd) && minutesOf(aEnd) > minutesOf(bStart);
}

/**
 * GET /api/mobile/blocks?from=YYYY-MM-DD&to=YYYY-MM-DD
 * Returns server-side time blocks for the requested range.
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
                    date: { gte: dayStart(from), lte: dayEnd(to) },
                }),
            },
            orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
        });

        return NextResponse.json(blocks.map((block) => ({
            id: block.id,
            date: block.date.toISOString().split('T')[0],
            startTime: block.startTime || '00:00',
            endTime: block.endTime || '23:59',
            type: block.type || 'personal',
            reason: block.reason || null,
        })));
    } catch (error) {
        console.error('[mobile/blocks GET]', error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}

/**
 * POST /api/mobile/blocks
 * Create one or more server-side DiaryBlock rows.
 * Body supports both beta formats:
 * - { date, startTime, endTime, type, reason }
 * - { startDate, endDate, startTime?, endTime?, type, reason?, cancelIntersectingSessions? }
 */
export async function POST(req: NextRequest) {
    const auth = await authenticateMobileRequest(req);
    if (!auth) return unauthorizedResponse();

    try {
        const body = await req.json();
        const startDate = body.startDate || body.date;
        const endDate = body.endDate || startDate;
        const type = typeof body.type === 'string' && body.type.trim() ? body.type.trim() : 'personal';
        const reason = typeof body.reason === 'string' && body.reason.trim() ? body.reason.trim() : null;
        const startTime = normalizeTime(body.startTime, '00:00');
        const endTime = normalizeTime(body.endTime, body.startTime ? '23:59' : '23:59');

        if (!startDate) {
            return NextResponse.json({ error: 'startDate or date required' }, { status: 400 });
        }
        if (minutesOf(startTime) >= minutesOf(endTime)) {
            return NextResponse.json({ error: 'endTime must be after startTime' }, { status: 400 });
        }

        const start = dayStart(startDate);
        const end = dayStart(endDate);
        if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
            return NextResponse.json({ error: 'Invalid date range' }, { status: 400 });
        }

        const blocksToCreate = [];
        for (const cursor = new Date(start); cursor <= end; cursor.setDate(cursor.getDate() + 1)) {
            blocksToCreate.push({
                psychologistId: auth.userId,
                date: new Date(cursor),
                startTime,
                endTime,
                type,
                reason,
            });
        }

        const created = await db.diaryBlock.createMany({ data: blocksToCreate });

        let cancelled = 0;
        if (body.cancelIntersectingSessions) {
            const sessionsToCancel = await db.diarySession.findMany({
                where: {
                    psychologistId: auth.userId,
                    date: { gte: start, lte: dayEnd(endDate) },
                    status: { notIn: ['cancelled', 'completed', 'no_show'] },
                },
                include: { client: true },
            });

            const intersecting = sessionsToCancel.filter((session) => {
                const sessionStart = session.time || '00:00';
                const sessionEnd = session.endTime || (() => {
                    const endMinutes = minutesOf(sessionStart) + (session.duration || 50);
                    return `${String(Math.floor(endMinutes / 60) % 24).padStart(2, '0')}:${String(endMinutes % 60).padStart(2, '0')}`;
                })();
                return overlaps(startTime, endTime, sessionStart, sessionEnd);
            });

            if (intersecting.length > 0) {
                await db.diarySession.updateMany({
                    where: { id: { in: intersecting.map((session) => session.id) } },
                    data: { status: 'cancelled' },
                });
                cancelled = intersecting.length;

                for (const session of intersecting) {
                    const client = session.client as any;
                    const message = `Ваша запись на ${session.date.toLocaleDateString('ru-RU')} в ${session.time} отменена${reason ? `: ${reason}` : ''}. Если будет удобно, свяжитесь со специалистом для переноса.`;
                    try {
                        if (client?.telegramChatId) {
                            const { sendTelegramMessage } = await import('@/lib/telegram');
                            await sendTelegramMessage(client.telegramChatId, message);
                        } else if (client?.maxChatId) {
                            const { sendMaxMessage } = await import('@/lib/max-bot');
                            await sendMaxMessage(client.maxChatId, message);
                        }
                    } catch (error) {
                        console.error('[mobile/blocks POST] notify cancelled session failed:', error);
                    }
                }
            }
        }

        return NextResponse.json({ ok: true, created: created.count, cancelled }, { status: 201 });
    } catch (error) {
        console.error('[mobile/blocks POST]', error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
