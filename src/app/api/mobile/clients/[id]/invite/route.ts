import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateMobileRequest, unauthorizedResponse } from '@/lib/mobile-auth';
import { randomBytes } from 'crypto';

const TELEGRAM_BOT_USERNAME = process.env.TELEGRAM_BOT_USERNAME || 'CompasProBot';
const MAX_BOT_USERNAME = process.env.MAX_BOT_USERNAME || '';

/**
 * POST /api/mobile/clients/[id]/invite
 * Generate an invite link for the client to link their Telegram or MAX account.
 * Body: { channel: 'telegram' | 'max' }
 * Response: { inviteLink, deepLink, channel, expiresAt }
 *
 * The link format: t.me/<bot>?start=c_<token>
 * When the client taps it, the bot resolves the token and links their account.
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

        const { channel = 'telegram' } = await req.json().catch(() => ({ channel: 'telegram' }));

        if (!['telegram', 'max'].includes(channel)) {
            return NextResponse.json({ error: 'channel must be telegram or max' }, { status: 400 });
        }

        // Generate a secure token (expires in 30 days)
        const token = randomBytes(24).toString('base64url');
        const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

        await db.clientInviteToken.create({
            data: {
                psychologistId: auth.userId,
                clientId,
                token,
                channel,
                expiresAt,
            },
        });

        let inviteLink: string;
        if (channel === 'telegram') {
            inviteLink = `https://t.me/${TELEGRAM_BOT_USERNAME}?start=c_${token}`;
        } else {
            inviteLink = MAX_BOT_USERNAME
                ? `https://max.ru/join/${MAX_BOT_USERNAME}?start=c_${token}`
                : `https://cmpas.ru/max-invite?token=${token}`;
        }

        return NextResponse.json({
            inviteLink,
            channel,
            expiresAt: expiresAt.toISOString(),
            clientName: client.name,
            phone: client.phone || null,
        });
    } catch (error) {
        console.error('[mobile/clients/id/invite POST]', error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
