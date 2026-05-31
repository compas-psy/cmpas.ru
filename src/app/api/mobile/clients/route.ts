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
            include: {
                _count: { select: { sessions: true } },
                sessions: {
                    orderBy: { date: 'desc' },
                    take: 1,
                    select: { date: true },
                },
            },
            orderBy: { name: 'asc' },
        });

        const now = new Date();
        const upcomingSessions = await db.diarySession.findMany({
            where: {
                psychologistId: auth.userId,
                date: { gte: now },
                status: { not: 'cancelled' },
            },
            select: { clientId: true, date: true, time: true },
            orderBy: { date: 'asc' },
        });

        const nextSessionMap = new Map<string, { date: string; time: string }>();
        for (const s of upcomingSessions) {
            if (s.clientId && !nextSessionMap.has(s.clientId)) {
                nextSessionMap.set(s.clientId, {
                    date: s.date.toISOString().split('T')[0],
                    time: s.time || '',
                });
            }
        }

        const formatted = clients.map(c => {
            const nextSess = nextSessionMap.get(c.id);
            return {
                id: c.id,
                name: c.name,
                email: c.email || null,
                phone: c.phone || null,
                telegramId: c.telegramChatId || null,
                sessionsCount: c._count.sessions,
                lastSessionDate: c.sessions[0]?.date?.toISOString().split('T')[0] || null,
                notes: null,
                status: (c.status || 'active').toUpperCase(),
                nextSessionDate: nextSess?.date || null,
                nextSessionTime: nextSess?.time || null,
            };
        });

        return NextResponse.json(formatted);
    } catch (error) {
        console.error('[mobile/clients]', error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    const auth = await authenticateMobileRequest(req);
    if (!auth) return unauthorizedResponse();

    try {
        const { name, email, phone } = await req.json();

        if (!name || typeof name !== 'string') {
            return NextResponse.json({ error: 'Name required' }, { status: 400 });
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
                },
            })
            : await db.diaryClient.create({
                data: {
                    psychologistId: auth.userId,
                    name: name.trim(),
                    email: email || null,
                    phone: normalizedPhone,
                },
            });

        const sessionsCount = existing ? await db.diarySession.count({ where: { clientId: client.id } }) : 0;

        return NextResponse.json({
            id: client.id,
            name: client.name,
            email: client.email,
            phone: client.phone,
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
