import { NextRequest, NextResponse } from 'next/server';
import { authenticateMobileRequest, unauthorizedResponse } from '@/lib/mobile-auth';
import {
    createClientChannelInvite,
    getClientChannelStatus,
    revokeClientChannel,
    type ChannelInvitePreference,
    type ClientChannel,
} from '@/lib/channel-binding';

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    const auth = await authenticateMobileRequest(req);
    if (!auth) return unauthorizedResponse();
    const { id } = await params;

    try {
        return NextResponse.json(await getClientChannelStatus(auth.userId, id));
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Internal error';
        return NextResponse.json({ error: message }, { status: message === 'Клиент не найден' ? 404 : 500 });
    }
}

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    const auth = await authenticateMobileRequest(req);
    if (!auth) return unauthorizedResponse();
    const { id } = await params;
    const body = await req.json().catch(() => ({ channel: 'auto' }));
    const channel = (body.channel || 'auto') as string;

    if (!['telegram', 'max', 'auto'].includes(channel)) {
        return NextResponse.json({ error: 'Unsupported channel' }, { status: 400 });
    }

    try {
        const invite = await createClientChannelInvite({
            psychologistId: auth.userId,
            clientId: id,
            channel: channel as ChannelInvitePreference,
        });
        return NextResponse.json({
            channel: invite.channel,
            inviteLink: invite.smartLink,
            directLink: invite.directLink,
            directLinks: invite.directLinks,
            shareText: invite.shareText,
            expiresAt: invite.expiresAt.toISOString(),
            clientName: invite.clientName,
            phone: invite.phone || null,
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Internal error';
        return NextResponse.json({ error: message }, { status: message === 'Клиент не найден' ? 404 : 500 });
    }
}

export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    const auth = await authenticateMobileRequest(req);
    if (!auth) return unauthorizedResponse();
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const channel = body.channel as string | undefined;

    if (channel !== 'telegram' && channel !== 'max') {
        return NextResponse.json({ error: 'channel must be telegram or max' }, { status: 400 });
    }

    try {
        await revokeClientChannel({
            psychologistId: auth.userId,
            clientId: id,
            channel: channel as ClientChannel,
        });
        return NextResponse.json({ ok: true, channel });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Internal error';
        return NextResponse.json({ error: message }, { status: message === 'Клиент не найден' ? 404 : 500 });
    }
}
