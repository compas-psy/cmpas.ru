import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateMobileRequest, unauthorizedResponse } from '@/lib/mobile-auth';
import { sendTelegramMessage } from '@/lib/telegram';
import { sendMaxMessage } from '@/lib/max-bot';
import { buildSessionClientMessage, clientBookingLink, getPaymentInstruction } from '@/lib/client-workflow';

/**
 * POST /api/mobile/clients/[id]/message
 * Send a message to a client or build ready-to-send text for manual delivery.
 *
 * Body:
 *   { type: 'custom', text: string } — arbitrary message
 *   { type: 'reminder', sessionId: string } — reminder template (like the screenshot)
 *
 * Response:
 *   If client has Telegram/MAX → message sent, status: 'telegram'|'max'
 *   If not linked → status: 'manual', readyText: string (for share-sheet)
 */
export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const auth = await authenticateMobileRequest(req);
    if (!auth) return unauthorizedResponse();
    const { id: clientId } = await params;

    try {
        const client = await db.diaryClient.findFirst({
            where: { id: clientId, psychologistId: auth.userId },
        });
        if (!client) return NextResponse.json({ error: 'Not found' }, { status: 404 });

        const body = await req.json();
        const { type } = body;

        let text = '';

        if (type === 'custom') {
            text = String(body.text || '').trim();
            if (!text) return NextResponse.json({ error: 'text required' }, { status: 400 });

        } else if (type === 'reminder') {
            const sessionId = body.sessionId;
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

            text = buildSessionClientMessage({
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

        const tgId = client.telegramChatId;
        const maxId = (client as any).maxChatId as string | null;

        let status: string;
        if (tgId) {
            await sendTelegramMessage(tgId, text);
            status = 'telegram';
        } else if (maxId) {
            await sendMaxMessage(maxId, text);
            status = 'max';
        } else {
            // No messenger — return ready text for share-sheet
            return NextResponse.json({
                status: 'manual',
                readyText: text,
                phone: client.phone || null,
            });
        }

        return NextResponse.json({ status, sentAt: new Date().toISOString() });
    } catch (error) {
        console.error('[mobile/clients/id/message POST]', error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
