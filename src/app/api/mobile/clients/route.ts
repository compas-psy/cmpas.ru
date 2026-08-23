import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateMobileRequest, unauthorizedResponse } from '@/lib/mobile-auth';
import { normalizePhone, phoneLookupVariants } from '@/lib/clients/phone';

export async function GET(req: NextRequest) {
    const auth = await authenticateMobileRequest(req);
    if (!auth) return unauthorizedResponse();

    const search = req.nextUrl.searchParams.get('search') || '';

    try {
        const clients = await db.diaryClient.findMany({
            where: {
                psychologistId: auth.userId,
                ...(search && {
                    OR: [
                        { name: { contains: search, mode: 'insensitive' as const } },
                        { phone: { contains: search.replace(/\s/g, ''), mode: 'insensitive' as const } },
                        { email: { contains: search, mode: 'insensitive' as const } },
                    ],
                }),
            },
            include: { _count: { select: { sessions: true } } },
            orderBy: { name: 'asc' },
        });

        const now = new Date();
        const [upcomingSessions, recentSessions] = await Promise.all([
            db.diarySession.findMany({
                where: {
                    psychologistId: auth.userId,
                    date: { gte: now },
                    status: { not: 'cancelled' },
                },
                select: { clientId: true, date: true, time: true },
                orderBy: [{ date: 'asc' }, { time: 'asc' }],
            }),
            db.diarySession.findMany({
                where: {
                    psychologistId: auth.userId,
                    date: { lt: now },
                    status: { not: 'cancelled' },
                },
                select: { clientId: true, date: true, time: true },
                orderBy: [{ date: 'desc' }, { time: 'desc' }],
            }),
        ]);

        const nextSessionMap = new Map<string, { date: string; time: string }>();
        for (const session of upcomingSessions) {
            if (session.clientId && !nextSessionMap.has(session.clientId)) {
                nextSessionMap.set(session.clientId, {
                    date: session.date.toISOString().split('T')[0],
                    time: session.time || '',
                });
            }
        }

        const lastSessionMap = new Map<string, { date: string; time: string }>();
        for (const session of recentSessions) {
            if (session.clientId && !lastSessionMap.has(session.clientId)) {
                lastSessionMap.set(session.clientId, {
                    date: session.date.toISOString().split('T')[0],
                    time: session.time || '',
                });
            }
        }

        return NextResponse.json(clients.map(client => {
            const next = nextSessionMap.get(client.id);
            const last = lastSessionMap.get(client.id);
            return {
                id: client.id,
                name: client.name,
                email: client.email || null,
                phone: client.phone || null,
                gender: client.gender || null,
                telegramId: client.telegramChatId || null,
                maxId: client.maxChatId || null,
                sessionsCount: client._count.sessions,
                lastSessionDate: last?.date || null,
                lastSessionTime: last?.time || null,
                notes: null,
                status: (client.status || 'active').toUpperCase(),
                nextSessionDate: next?.date || null,
                nextSessionTime: next?.time || null,
            };
        }));
    } catch (error) {
        console.error('[mobile/clients]', error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    const auth = await authenticateMobileRequest(req);
    if (!auth) return unauthorizedResponse();

    try {
        const { name, email, phone, gender, clientRequestId } = await req.json();

        if (!name || typeof name !== 'string') {
            return NextResponse.json({ error: 'Name required' }, { status: 400 });
        }

        // Идемпотентность досылки — см. DiarySession.clientRequestId. Проверка
        // идёт до поиска по телефону: у клиента, заведённого без телефона,
        // совпадать нечему, и повтор создавал бы вторую карточку.
        const idempotencyKey = typeof clientRequestId === 'string' && clientRequestId ? clientRequestId : null;
        if (idempotencyKey) {
            const already = await db.diaryClient.findFirst({
                where: { clientRequestId: idempotencyKey, psychologistId: auth.userId } as any,
            });
            if (already) {
                const count = await db.diarySession.count({ where: { clientId: already.id } });
                return NextResponse.json({
                    id: already.id,
                    name: already.name,
                    email: already.email,
                    phone: already.phone,
                    gender: already.gender,
                    status: (already.status || 'active').toUpperCase(),
                    sessionsCount: count,
                });
            }
        }

        const normalizedPhone = normalizePhone(phone);
        const variants = phoneLookupVariants(normalizedPhone || phone);
        const existing = variants.length ? await db.diaryClient.findFirst({
            where: { psychologistId: auth.userId, phone: { in: variants } },
            orderBy: { updatedAt: 'desc' },
        }) : null;

        const client = existing
            ? await db.diaryClient.update({
                where: { id: existing.id },
                data: {
                    ...(existing.status === 'archived' ? { status: 'active' } : {}),
                    ...(!existing.email && email ? { email } : {}),
                    ...(!existing.phone && normalizedPhone ? { phone: normalizedPhone } : {}),
                    ...(!existing.gender && gender ? { gender } : {}),
                },
            })
            : await db.diaryClient.create({
                data: {
                    psychologistId: auth.userId,
                    name: name.trim(),
                    email: email || null,
                    phone: normalizedPhone,
                    gender: gender || null,
                    clientRequestId: idempotencyKey,
                } as any,
            });

        const sessionsCount = existing ? await db.diarySession.count({ where: { clientId: client.id } }) : 0;

        return NextResponse.json({
            id: client.id,
            name: client.name,
            email: client.email,
            phone: client.phone,
            gender: client.gender,
            telegramId: client.telegramChatId || null,
            maxId: client.maxChatId || null,
            sessionsCount,
            lastSessionDate: null,
            status: (client.status || 'active').toUpperCase(),
            alreadyExists: !!existing,
        });
    } catch (error) {
        console.error('[mobile/clients]', error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
