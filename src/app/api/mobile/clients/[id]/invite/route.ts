import { NextRequest, NextResponse } from 'next/server';
import { authenticateMobileRequest, unauthorizedResponse } from '@/lib/mobile-auth';
import { createClientChannelInvite, type ClientChannel } from '@/lib/channel-binding';

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const auth = await authenticateMobileRequest(req);
    if (!auth) return unauthorizedResponse();
    const { id: clientId } = await params;

    try {
        const body = await req.json().catch(() => ({ channel: 'telegram' }));
        const channel = body.channel as string;
        if (channel !== 'telegram' && channel !== 'max') {
            return NextResponse.json({ error: 'channel must be telegram or max' }, { status: 400 });
        }

        const invite = await createClientChannelInvite({
            psychologistId: auth.userId,
            clientId,
            channel: channel as ClientChannel,
        });

        return NextResponse.json({
            inviteLink: invite.smartLink,
            directLink: invite.directLink,
            shareText: invite.shareText,
            channel: invite.channel,
            expiresAt: invite.expiresAt.toISOString(),
            clientName: invite.clientName,
            phone: invite.phone || null,
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Internal error';
        console.error('[mobile/clients/id/invite POST]', error);
        return NextResponse.json({ error: message }, { status: message === 'Клиент не найден' ? 404 : 500 });
    }
}
