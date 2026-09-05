import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { createNotification } from '@/lib/notifications';
import { observePaymentSettled } from '@/lib/practice/attention-completion';

const ALLOWED = new Set(['not_required', 'unpaid', 'paid']);

export async function GET(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
    const session = await auth();
    const psychologistId = session?.user?.id;
    if (!psychologistId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await context.params;
    try {
        const rows = await db.$queryRaw<Array<{ id: string; paymentStatus: string | null }>>(Prisma.sql`
            SELECT id, "paymentStatus"
            FROM "DiarySession"
            WHERE id = ${id} AND "psychologistId" = ${psychologistId}
            LIMIT 1
        `);
        const found = rows[0];
        if (!found) return NextResponse.json({ error: 'Session not found' }, { status: 404 });
        return NextResponse.json({ id, paymentStatus: found.paymentStatus || 'not_required' });
    } catch (error) {
        console.error('[diary/sessions/payment GET]', error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
    const session = await auth();
    const psychologistId = session?.user?.id;
    if (!psychologistId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await context.params;
    const body = await req.json().catch(() => ({}));
    const paymentStatus = String(body.paymentStatus || '').toLowerCase();
    if (!ALLOWED.has(paymentStatus)) {
        return NextResponse.json({ error: 'paymentStatus must be not_required, unpaid or paid' }, { status: 400 });
    }

    try {
        const rows = await db.$queryRaw<Array<{ id: string; clientId: string; clientName: string | null; paymentStatus: string | null }>>(Prisma.sql`
            SELECT s.id, s."clientId", s."paymentStatus", c.name as "clientName"
            FROM "DiarySession" s
            LEFT JOIN "DiaryClient" c ON c.id = s."clientId"
            WHERE s.id = ${id} AND s."psychologistId" = ${psychologistId}
            LIMIT 1
        `);
        const found = rows[0];
        if (!found) return NextResponse.json({ error: 'Session not found' }, { status: 404 });

        await db.$executeRaw(Prisma.sql`
            UPDATE "DiarySession"
            SET "paymentStatus" = ${paymentStatus}, "updatedAt" = NOW()
            WHERE id = ${id} AND "psychologistId" = ${psychologistId}
        `);

        // Задача 25 §8: проблема «не отмечена оплата» закрыта только если
        // сессия действительно ушла из unpaid — повторное «оплачено» у уже
        // оплаченной ничего не закрывает.
        await observePaymentSettled(psychologistId, found.paymentStatus, paymentStatus);

        if (paymentStatus === 'paid') {
            await db.$executeRaw(Prisma.sql`
                UPDATE "SessionPaymentRequest"
                SET status = 'paid', "markedPaidAt" = COALESCE("markedPaidAt", NOW()), "updatedAt" = NOW()
                WHERE "sessionId" = ${id}
            `).catch(() => undefined);
        }

        if (paymentStatus === 'unpaid') {
            await createNotification({
                psychologistId,
                type: 'session_unpaid',
                title: 'Сессия ожидает отметки оплаты',
                subtitle: found.clientName || 'Клиент',
                sessionId: id,
                clientId: found.clientId,
            });
        }

        return NextResponse.json({ ok: true, id, paymentStatus });
    } catch (error) {
        console.error('[diary/sessions/payment PATCH]', error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
