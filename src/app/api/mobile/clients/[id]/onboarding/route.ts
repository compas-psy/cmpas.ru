import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { db } from '@/lib/db';
import { authenticateMobileRequest, unauthorizedResponse } from '@/lib/mobile-auth';
import { sendTelegramMessage } from '@/lib/telegram';
import { sendMaxMessage } from '@/lib/max-bot';
import { buildSessionClientMessage, clientBookingLink, getPaymentInstruction, createClientDocumentDelivery } from '@/lib/client-workflow';
import { buildClientOnboardingMessage } from '@/lib/practice/communications';

const TELEGRAM_BOT_USERNAME = process.env.TELEGRAM_BOT_USERNAME || 'CompasProBot';
const MAX_BOT_USERNAME = process.env.MAX_BOT_USERNAME || '';

function buildInviteLink(channel: 'telegram' | 'max', token: string) {
    if (channel === 'telegram') return `https://t.me/${TELEGRAM_BOT_USERNAME}?start=c_${token}`;
    return MAX_BOT_USERNAME
        ? `https://max.ru/join/${MAX_BOT_USERNAME}?start=c_${token}`
        : `https://cmpas.ru/max-invite?token=${token}`;
}

/**
 * GET /api/mobile/clients/[id]/onboarding
 * Options for the onboarding sheet: messenger status, documents, hasSession.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const auth = await authenticateMobileRequest(req);
    if (!auth) return unauthorizedResponse();
    const { id: clientId } = await params;

    const client = await db.diaryClient.findFirst({
        where: { id: clientId, psychologistId: auth.userId },
        select: { id: true, name: true, phone: true, telegramChatId: true, maxChatId: true },
    });
    if (!client) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    let documents: Array<{ id: string; title: string }> = [];
    try {
        const rows = await db.$queryRaw<Array<{ id: string; title: string }>>`
            SELECT id, title FROM "PsychologistClientDocument"
            WHERE "psychologistId" = ${auth.userId} AND "isActive" = true
            ORDER BY "sortOrder" ASC, "createdAt" ASC
        `;
        documents = rows.map(r => ({ id: r.id, title: r.title }));
    } catch { /* table may not exist */ }

    const session = await db.diarySession.findFirst({
        where: { clientId, psychologistId: auth.userId, status: { not: 'cancelled' } },
        orderBy: { date: 'asc' },
        select: { id: true },
    });

    return NextResponse.json({
        clientName: client.name,
        phone: client.phone ?? null,
        hasTelegram: !!client.telegramChatId,
        hasMax: !!(client as any).maxChatId,
        documents,
        hasSession: !!session,
    });
}

/**
 * POST /api/mobile/clients/[id]/onboarding
 * Body: { channel: 'telegram'|'max', sendNotification: boolean, documentId?: string }
 * Sends instantly if connected, else queues + returns invite link + ready text.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const auth = await authenticateMobileRequest(req);
    if (!auth) return unauthorizedResponse();
    const { id: clientId } = await params;

    try {
        const client = await db.diaryClient.findFirst({ where: { id: clientId, psychologistId: auth.userId } });
        if (!client) return NextResponse.json({ error: 'Not found' }, { status: 404 });

        const body = await req.json();
        const channel: 'telegram' | 'max' = body.channel === 'max' ? 'max' : 'telegram';
        const sendNotification = !!body.sendNotification;
        const documentId: string | null = body.documentId || null;

        const psych = await db.user.findUnique({
            where: { id: auth.userId },
            include: { psychologistSettings: true },
        });
        const psyName = psych?.psychologistSettings?.fullName || psych?.name || 'специалист';
        const bookingLink = clientBookingLink(auth.userId, clientId);

        const session = sendNotification
            ? await db.diarySession.findFirst({
                where: { clientId, psychologistId: auth.userId, status: { not: 'cancelled' } },
                orderBy: { date: 'asc' },
            })
            : null;

        let documentLinks: Array<{ title: string; link: string }> = [];
        if (documentId) {
            const delivery = await createClientDocumentDelivery({
                psychologistId: auth.userId,
                clientId,
                sessionId: session?.id ?? null,
                channel,
                recipientContact: client.phone || client.email || null,
                documentId,
            });
            documentLinks = [{ title: delivery.title, link: delivery.link }];
        }

        let htmlText: string;
        let plainText: string;
        if (session) {
            const onlineLink = session.format === 'online' ? psych?.psychologistSettings?.onlineSessionLink : null;
            const paymentText = await getPaymentInstruction(auth.userId, session.id, clientId);
            const base = {
                clientName: client.name,
                psychologistName: psyName,
                date: session.date,
                time: session.time,
                format: session.format,
                onlineLink,
                documentLinks,
                paymentText,
                bookingLink,
            };
            htmlText = buildSessionClientMessage({ ...base, mode: 'html' });
            plainText = buildSessionClientMessage({ ...base, mode: 'plain' });
        } else {
            const base = { clientName: client.name, psychologistName: psyName, documentLinks, bookingLink };
            htmlText = buildClientOnboardingMessage({ ...base, mode: 'html' });
            plainText = buildClientOnboardingMessage({ ...base, mode: 'plain' });
        }
        const text = channel === 'telegram' ? htmlText : plainText;

        const chatId = channel === 'telegram' ? client.telegramChatId : (client as any).maxChatId as string | null;
        if (chatId) {
            if (channel === 'telegram') await sendTelegramMessage(chatId, htmlText, { parse_mode: 'HTML', disable_web_page_preview: true });
            else await sendMaxMessage(chatId, plainText);
            return NextResponse.json({ status: 'sent', channel });
        }

        const token = randomBytes(24).toString('base64url');
        const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        await db.clientInviteToken.create({ data: { psychologistId: auth.userId, clientId, token, channel, expiresAt } });
        await db.scheduledClientMessage.create({
            data: { psychologistId: auth.userId, clientId, sessionId: session?.id ?? null, channel, text, sendAt: expiresAt, status: 'pending' },
        });

        return NextResponse.json({
            status: 'pending',
            channel,
            inviteLink: buildInviteLink(channel, token),
            readyText: plainText,
            phone: client.phone ?? null,
        });
    } catch (error) {
        console.error('[mobile/clients/id/onboarding POST]', error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
