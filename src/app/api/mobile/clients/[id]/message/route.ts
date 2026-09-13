import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateMobileRequest, unauthorizedResponse } from '@/lib/mobile-auth';
import { deliverMessage, pickChannel } from '@/lib/messaging/deliver';
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

        // КАНАЛ: ЛИБО ВЫБРАННЫЙ ЧЕЛОВЕКОМ, ЛИБО ОБЩЕЕ ПРАВИЛО.
        //
        // Раньше здесь стояло «есть telegramChatId — пишем в Telegram», и у
        // клиента с двумя мессенджерами выбор специалиста не значил ничего.
        // Заодно отправка шла мимо deliverMessage — а это она прячет ссылки
        // в кнопки MAX; голая ссылка на полторы строки приходила именно
        // отсюда.
        const requested = body.channel === 'telegram' || body.channel === 'max' ? body.channel : null;
        const bearer = {
            telegramChatId: client.telegramChatId,
            maxChatId: (client as any).maxChatId as string | null,
            preferredChannel: requested ?? client.preferredChannel,
        };
        const picked = pickChannel(bearer);

        let status: string;
        if (picked) {
            const delivery = await deliverMessage(bearer, text);
            if (!delivery.sent) {
                return NextResponse.json({ error: 'Не удалось отправить сообщение' }, { status: 502 });
            }
            status = delivery.channel ?? picked.channel;
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
