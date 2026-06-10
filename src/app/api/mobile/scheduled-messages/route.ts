import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateMobileRequest, unauthorizedResponse } from '@/lib/mobile-auth';
import { buildSessionClientMessage, clientBookingLink, getPaymentInstruction } from '@/lib/client-workflow';

/**
 * GET /api/mobile/scheduled-messages
 * Returns upcoming scheduled messages for the psychologist.
 */
export async function GET(req: NextRequest) {
    const auth = await authenticateMobileRequest(req);
    if (!auth) return unauthorizedResponse();

    try {
        const messages = await db.scheduledClientMessage.findMany({
            where: { psychologistId: auth.userId, status: 'pending' },
            orderBy: { sendAt: 'asc' },
            take: 50,
        });
        return NextResponse.json(messages.map(m => ({
            id: m.id,
            clientId: m.clientId,
            sessionId: m.sessionId,
            channel: m.channel,
            text: m.text,
            sendAt: m.sendAt.toISOString(),
            status: m.status,
        })));
    } catch (error) {
        console.error('[mobile/scheduled-messages GET]', error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}

/**
 * POST /api/mobile/scheduled-messages
 * Schedule a message to a client.
 *
 * Body:
 *   { clientId, sendAt (ISO), type: 'custom'|'reminder', text?, sessionId? }
 */
export async function POST(req: NextRequest) {
    const auth = await authenticateMobileRequest(req);
    if (!auth) return unauthorizedResponse();

    try {
        const { clientId, sendAt, type, text: customText, sessionId } = await req.json();
        if (!clientId || !sendAt || !type) {
            return NextResponse.json({ error: 'clientId, sendAt, type required' }, { status: 400 });
        }

        const client = await db.diaryClient.findFirst({
            where: { id: clientId, psychologistId: auth.userId },
        });
        if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 });

        let messageText = '';
        const channel = client.telegramChatId ? 'telegram' : (client as any).maxChatId ? 'max' : 'manual';

        if (type === 'custom') {
            messageText = String(customText || '').trim();
            if (!messageText) return NextResponse.json({ error: 'text required for custom type' }, { status: 400 });

        } else if (type === 'reminder') {
            if (!sessionId) return NextResponse.json({ error: 'sessionId required for reminder' }, { status: 400 });
            const session = await db.diarySession.findFirst({
                where: { id: sessionId, psychologistId: auth.userId },
            });
            if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 });

            const psych = await db.user.findUnique({
                where: { id: auth.userId },
                include: { psychologistSettings: true },
            });
            const psyName = psych?.psychologistSettings?.fullName || psych?.name || 'специалист';
            const bookingLink = clientBookingLink(auth.userId, clientId);
            const onlineLink = session.format === 'online' ? psych?.psychologistSettings?.onlineSessionLink : null;
            const paymentText = await getPaymentInstruction(auth.userId, sessionId, clientId);
            messageText = buildSessionClientMessage({
                clientName: client.name,
                psychologistName: psyName,
                date: session.date,
                time: session.time,
                format: session.format,
                onlineLink,
                documentLinks: [],
                paymentText,
                bookingLink,
            });
        } else {
            return NextResponse.json({ error: 'type must be custom or reminder' }, { status: 400 });
        }

        const scheduled = await db.scheduledClientMessage.create({
            data: {
                psychologistId: auth.userId,
                clientId,
                sessionId: sessionId || null,
                channel,
                text: messageText,
                sendAt: new Date(sendAt),
                status: channel === 'manual' ? 'manual_pending' : 'pending',
            },
        });

        return NextResponse.json({
            id: scheduled.id,
            clientId: scheduled.clientId,
            channel: scheduled.channel,
            sendAt: scheduled.sendAt.toISOString(),
            status: scheduled.status,
            readyText: channel === 'manual' ? messageText : undefined,
        }, { status: 201 });
    } catch (error) {
        console.error('[mobile/scheduled-messages POST]', error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
